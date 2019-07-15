#!/usr/bin/env node
const S3 = require("aws-sdk/clients/s3"),
  Cloudfront = require("aws-sdk/clients/cloudfront"),
  fs = require("fs"),
  awsCredentials = require(process.cwd() + "/aws.js"),
  path = require("path"),
  parseArgs = require("minimist"),
  mime = require('mime-types');

const args = parseArgs(process.argv);

let relativePath, env = "development";

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

const emptyBucket = (bucketName, callback) => {
  let params = {
    Bucket: bucketName
  };

  uploader.listObjectsV2(params, function (err, data) {
    if (err) return callback(err);

    if (data.Contents.length == 0) callback();

    params = { Bucket: bucketName };
    params.Delete = { Objects: [] };

    data.Contents.forEach(content => {
      if (!options.preserveFiles || !options.preserveFiles.includes(content.Key)) {
        params.Delete.Objects.push({ Key: content.Key });
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
      uploader.putObject(
        {
          Bucket: credentials.bucket,
          Key: fileKey,
          Body: base64data,
          ACL: "public-read",
          CacheControl: "max-age=6048000",
          Expires: 6048000,
          ContentType: mime.lookup(file)
        },
        (error) => {
          if (error) return reject(error);
          console.log("Successfully uploaded", file);
          return resolve(file);
        }
      );
    });
  });
}

const recursiveRead = (dir, done) => {
  var results = [];
  fs.readdir(dir, function (err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function (file) {
      file = path.resolve(dir, file);
      fs.stat(file, function (_, stat) {
        if (stat && stat.isDirectory()) {
          recursiveRead(file, function (_, res) {
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

const uploadFiles = () => recursiveRead(buildPath, (err, results) => {
  if (err) throw err;
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
          Quantity: results.length,
          Items: results.map(result => result.slice(result.indexOf(buildDirectoryName) + buildDirectoryName.length).replace(/\s+/g, '%20'))
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
  }).catch(err => {
    console.log(err);
  });
});

emptyBucket(credentials.bucket, err => {
  console.log("Cleaning the bucket...");
  if (err) {
    console.error(err, err.stack);
  } else {
    console.log("Uploading new build...");
    uploadFiles();
  }
});
