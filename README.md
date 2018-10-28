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
    script/
      aws.js
      s3.js
    ...
```

- The `aws.js` file will contain credentials and will export them as an object like this

```js
module.exports = {
  development: {
    accessKeyId: "XXXXXXXXXXXXXXXXXXXX",
    secretAccessKey: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    region: "us-east-1",
    bucket: "<Name of the bucket>",
    distributionId: "XXXXXXXXXXXXXX"
  },
  stage: {
    accessKeyId: "XXXXXXXXXXXXXXXXXXXX",
    secretAccessKey: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    region: "us-east-1",
    bucket: "<Name of the bucket>",
    distributionId: "XXXXXXXXXXXXXX"
  }
};
```

- The  `build/` folder will contain the file you want to sync

- The `distributionId` is optional, in case you've got it. The script will create an invalidation for all your files.

## Params
You can run the script like this:

```
node script/s3.js <enviroment-name>
```

This enviroment name is the key of the main object exported in `aws.js`.

## Required dependencies

The dependency you need to install is [aws-sdk](https://www.npmjs.com/package/aws-sdk)


## About

This project is maintained by [Damián Finkelstein](https://github.com/damfinkel), [Pablo Ferro](https://github.com/pabloferro), [Francisco Iglesias](https://github.com/FrankIglesias) and [Lucas Zibell](https://github.com/LucasZibell) and it was written by [Wolox](http://www.wolox.com.ar).

![Wolox](https://raw.githubusercontent.com/Wolox/press-kit/master/logos/logo_banner.png)