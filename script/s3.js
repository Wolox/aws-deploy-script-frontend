const S3 = require("aws-sdk/clients/s3");
const Cloudfront = require("aws-sdk/clients/cloudfront");
const fs = require("fs");
const awsCredentials = require("./aws.js");
const path = require("path");

let credentials;
if (process.argv[2]) credentials = awsCredentials[process.argv[2]];
else throw "Param enviroment missing";

const uploader = new S3({
  region: credentials.region,
  apiVersion: "2006-03-01",
  credentials: credentials
});

function read(file) {
   return new Promise((resolve, _) => {
    fs.readFile("build/" + file, (_, data) => {
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
        function(error) {
          if (error && error.statusCode === 403) {
            reject("Invalid credentials");
          } else if (error) {
            reject("An error has occurred during the upload");
          }
          console.log('Successfully uploaded', file);
          resolve(file);
        }
      );
    });
  });
}



const recursiveRead = function(dir, done) {
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

recursiveRead("build/", function(err, results) {
  if (err) throw err;
  Promise.all(results
    .map(result => result.slice(result.indexOf("build") + 6))
    .map(read)).then(() => {
      var params = {
        DistributionId: credentials.distributionId, /* required */
        InvalidationBatch: { /* required */
          CallerReference: new Date().getTime().toString(), /* required */
          Paths: { /* required */
            Quantity: results.length, /* required */
            Items: results
          }
        }
      };

      if(credentials.distributionId)
      new Cloudfront({credentials}).createInvalidation(params, function(err, data) {
        if (err) console.log(err, err.stack);
        else console.log(data);
      });
    });
});
