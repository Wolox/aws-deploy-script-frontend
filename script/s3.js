#!/usr/bin/env node
const S3 = require("aws-sdk/clients/s3"),
  Cloudfront = require("aws-sdk/clients/cloudfront"),
  fs = require("fs"),
  awsCredentials = require(process.cwd() + "/aws.js"),
  path = require("path"),
  parseArgs = require("minimist"),
  mime = require('mime-types'),
  axios = require('axios');

const args = parseArgs(process.argv);
const colors = {
  red: '\x1b[31m%s\x1b[0m',
  green: '\x1b[32m%s\x1b[0m'
};

let relativePath, env = "development";
let outputPath = '';
const gzip = args.gzip || args.g;

if (args.path) relativePath = args.path;
else if (args.p) relativePath = args.p;

if (args.env) env = args.env;
else if (args.e) env = args.e;

if (args.outputPath) outputPath = args.outputPath;
else if (args.o) outputPath = args.o;

const buildDirectoryName = relativePath || "build";
const buildPath = path.join(process.cwd(), buildDirectoryName);

let credentials = { ...awsCredentials[env] };
const options = credentials.options || {};
delete credentials.options;
if (!credentials) throw "There are no credentials for environment: " + env;

const uploader = new S3({
  region: credentials.region,
  apiVersion: "2006-03-01",
  credentials: credentials,
  httpOptions: {
    timeout: 0
  }
});

const findRegexOrString = (array, value) =>
  array.some(string =>
    // if it is a regex string.test exist as a func, else is undefined
    string.test ? string.test(value) : value === string
  );

const emptyBucket = (bucketName, callback) => {
  let params = {
    Bucket: bucketName
  };

  uploader.listObjectsV2(params, (err, data) => {
    if (err) return callback(err);

    if (data.Contents.length == 0) callback();

    params = { Bucket: bucketName };
    params.Delete = { Objects: [] };
    data.Contents.forEach(content => {
      if (!options.preserveFiles || !findRegexOrString(options.preserveFiles, content.Key)) {
        params.Delete.Objects.push({ Key: content.Key });
        console.log(colors.red, `[Deleting]: ${content.Key}`);
      }
    });

    uploader.deleteObjects(params, (err, _) => {
      if (err) return callback(err);
      if (data.isTruncated) emptyBucket(bucketName, callback);
      else callback();
    });
  });
}

const isMainFile = file => file === "index.html";

const getMetadataObject = metaData => {
  if (gzip) {
    return { ...metaData, ContentEncoding: 'gzip' };
  } else {
    return metaData;
  }
};

const read = file => {
  return new Promise((resolve, _) => {
    fs.readFile(path.join(buildPath, file), (_, data) => {
      var base64data = Buffer.from(data, "binary");
      resolve(base64data);
    });
  }).then(base64data => {
    return new Promise((resolve, reject) => {
      const fileIsMainFile = isMainFile(file);
      let CacheControl = fileIsMainFile ? "max-age=0" : "max-age=6048000";
      let Expires = fileIsMainFile ? 0 : 6048000;
      const fileKey = outputPath ? `${outputPath}/${file}` : file;
      const metaData = {
        Bucket: credentials.bucket,
        Key: fileKey,
        Body: base64data,
        ACL: "public-read",
        CacheControl: CacheControl,
        Expires: Expires,
        ContentType: mime.lookup(file)
      };
      uploader.putObject(getMetadataObject(metaData),
        (error) => {
          if (error) return reject(error);
          console.log(colors.green, `Successfully uploaded ${file}`);
          return resolve(file);
        }
      );
    });
  });
}

const recursiveRead = (dir, done) => {
  var results = [];
  fs.readdir(dir, (err, list) => {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(file => {
      file = path.resolve(dir, file);
      fs.stat(file, (_, stat) => {
        if (stat && stat.isDirectory()) {
          recursiveRead(file, (_, res) => {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

const persistDeployTime = (deployTime, metricsInfo) => {
  if (metricsInfo.baseUrl) {
    const axiosApi = axios.create({
      baseURL: metricsInfo.baseUrl,
      timeout: 10000
    });
    body = {
      env,
      tech: metricsInfo.tech,
      repo_name: metricsInfo.repoName,
      metrics: [
        {
          name: 'deploy-time',
          version: '1.0',
          value: `${deployTime}`
        }
      ]
    }
    axiosApi.post('/metrics', body).then(() => console.log('Deploy time saved succesfully'), error => console.log(`Deploy time couldn't be saved error: ${error}`));
  } else {
    console.log("Deploy time couldn't be saved due to the missing api base url")
  }
} 

const uploadFiles = () => recursiveRead(buildPath, (err, results) => {
  if (err) throw err;
  const start = new Date();
  Promise.all(
    results
      .map(result =>
        read(result.slice(
          result.indexOf(buildDirectoryName) + buildDirectoryName.length + 1
        ))
      )
  ).then(() => {
    var params = {
      DistributionId: credentials.distributionId,
      InvalidationBatch: {
        CallerReference: new Date().getTime().toString(),
        Paths: {
          Quantity: 1,
          Items: ['/*']
        }
      }
    };

    if (credentials.distributionId) {
      new Cloudfront({ credentials }).createInvalidation(
        params,
        (err, data) => {
          if (err) console.log(err, err.stack);
          else console.log(data);
        }
      );
    }
    deployTime = (new Date().getTime() - start.getTime()) / 1000;
    if (awsCredentials.metrics) {
      persistDeployTime(deployTime, awsCredentials.metrics)
    }
  }).catch(err => {
    console.log(err);
  });
});

emptyBucket(credentials.bucket, err => {
  console.log(colors.green, "Cleaning the bucket...");
  if (err) {
    console.error(err, err.stack);
  } else {
    console.log(colors.green, "Uploading new build...");
    uploadFiles();
  }
});
