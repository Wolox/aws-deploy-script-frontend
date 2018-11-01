#!/usr/bin/env node
const S3 = require("aws-sdk/clients/s3"),
  Cloudfront = require("aws-sdk/clients/cloudfront"),
  fs = require("fs"),
  awsCredentials = require(process.cwd() + "/aws.js"),
  path = require("path"),
  parseArgs = require("minimist");

const args = parseArgs(process.argv);

let relativePath, env = "development";

if (args.path) relativePath = args.path;
else if (args.p) relativePath = args.p;

if (args.env) env = args.env;
else if (args.e) env = args.e;

const buildDirectoryName = relativePath || "build";
const buildPath = path.join(process.cwd(), buildDirectoryName);

credentials = awsCredentials[env];
if (!credentials) throw "There are no credentials for environment: " + env;

const uploader = new S3({
  region: credentials.region,
  apiVersion: "2006-03-01",
  credentials: credentials
});

function read(file) {
  return new Promise((resolve, _) => {
    fs.readFile(path.join(buildPath, file), (_, data) => {
      var base64data = new Buffer(data, "binary");
      resolve(base64data);
    });
  }).then(base64data => {
    return new Promise((resolve, reject) => {
      uploader.putObject(
        {
          Bucket: credentials.bucket,
          Key: file,
          Body: base64data,
          ACL: "public-read",
          CacheControl: "max-age=6048000",
          Expires: 6048000
        },
        (error) => {
          if (error) return reject("Invalid credentials");
          console.log("Successfully uploaded", file);
          resolve(file);
        }
      );
    });
  });
}

const recursiveRead = (dir, done) => {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(_, stat) {
        if (stat && stat.isDirectory()) {
          recursiveRead(file, function(_, res) {
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

recursiveRead(buildPath, (err, results) => {
  if (err) throw err;
  Promise.all(
    results
      .map(result =>
        read(result.slice(
          result.indexOf(buildDirectoryName) + buildDirectoryName.length +1
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
