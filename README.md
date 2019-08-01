# AWS Deploy script

[![FEArmy](https://github.com/Wolox/react-chat-widget/raw/master/assets/FEA_open_source_sm.png)](https://github.com/orgs/Wolox/teams/front-end-army/members)

AWS script for deploying your frontend applications.

## Introduction

The most common configuration used for our projects is using an S3 Bucket to contain our static files. Optionally you can have a CloudFront playing as a CDN.

The aim of this script is to read all your files and sync directly to the bucket without having to install AWS CLI or any kind of credentials configuration.


This script is cross project which means you only need to have a `build/` folder to sync.

## Folder structure
```
ROOT
    build/
      index.html
      ...
    aws.js
    ...
```

- The `aws.js` file should be at the root of your project, it will contain credentials and will export them as an object like this:

```js
module.exports = {
  development: {
    accessKeyId: "XXXXXXXXXXXXXXXXXXXX",
    secretAccessKey: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    region: "us-east-1",
    bucket: "<Name of the bucket>",
    distributionId: "XXXXXXXXXXXXXX",
    options: { // Optional
      preserveFiles: ["foo.txt", "bar.js"]
    }
  },
  stage: {
    accessKeyId: "XXXXXXXXXXXXXXXXXXXX",
    secretAccessKey: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    region: "us-east-1",
    bucket: "<Name of the bucket>",
    distributionId: "XXXXXXXXXXXXXX",
    options: { // Optional
      preserveFiles: ["static/baz.js"]
    }
  }
};
```

- The  `build/` folder will contain the file you want to sync

- The `distributionId` is optional, in case you've got it. The script will create an invalidation for all your files.

## Options

- `preserveFiles`. It allows to specify an array of S3 file paths that won't be removed when the script cleans the bucket before uploading the new build. It's useful if you want to upload files manually to the S3 bucket.

- `environment` or `e`. It specifies the environment in which you are going to deploy your app. Also the key of your `aws.js` file that has the corresponding credentials

- `path` or `p`. The path of you generated static build files.

- `outputPath` or `o`. The S3 path to upload your files  (e.g. in case you don't want to upload all files in the root of the bucket)

## Usage

You can install this package globally and run `aws-deploy`

```
npm install -g aws-deploy-script-fe
```

The command line to execute can be:

```
aws-deploy --env <enviroment-name> --path <build-path>
```
or
```
aws-deploy -e <enviroment-name> -p <build-path>
```

* This **enviroment-name** is the key of the main object exported in `aws.js`.
* If no **enviroment-name** is declared then it will use `development` as default.
* The **build-path** is optional and defaults to `build`.

## Required dependencies

The dependency you need to install is [aws-sdk](https://www.npmjs.com/package/aws-sdk)


## Required policies

To run this script you must add these action policies to the user configured in the `aws.js` file

```js
"Action": [
  "s3:GetObject",
  "s3:GetObjectAcl",
  "s3:ListMultipartUploadParts",
  "s3:PutObject",
  "s3:PutObjectAcl",
  "s3:DeleteObject",
  "cloudfront:CreateInvalidation"
]
```

## About

This project is maintained by [Damián Finkelstein](https://github.com/damfinkel), [Pablo Ferro](https://github.com/pabloferro), [Francisco Iglesias](https://github.com/FrankIglesias) and [Lucas Zibell](https://github.com/LucasZibell) and it was written by [Wolox](http://www.wolox.com.ar).

![Wolox](https://raw.githubusercontent.com/Wolox/press-kit/master/logos/logo_banner.png)
