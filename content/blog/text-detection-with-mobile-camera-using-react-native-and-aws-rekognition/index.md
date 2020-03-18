---
title: Text detection with mobile camera using React Native and AWS Rekognition
date: "2018-06-18"
description: ""
---

# Text detection with mobile camera using React Native and AWS Rekognition

Text detection with mobile camera using React Native and AWS Rekognition

<iframe src="https://medium.com/media/b13cd82208233d2fc173cb788344a377" frameborder=0></iframe>

I’ve been wanting to play around with text detection using react native along with starting writing articles such as this. So I think this is a fun little project to start with. In this post we’ll go through creating the app in the video above.

### **We’ll be using the following services and libs:**

* Create React Native App [https://github.com/react-community/create-react-native-app](https://github.com/react-community/create-react-native-app)

* AWS amplify [https://github.com/aws/aws-amplify](https://github.com/aws/aws-amplify)

* AWS Rekognition [https://aws.amazon.com/rekognition/](https://aws.amazon.com/rekognition/)
> All code in this post can be found here [https://github.com/glenbray/text-reader](https://github.com/glenbray/text-reader)

### **This will be split up into 3 different sections**

1. Configuration

1. UI

1. Text detection with camera and AWS Rekognition

## **Configuration**

First thing we’ll do is setup our environment and create the react native project.

### **First we’ll install create react native app.**

    $ npm i -g create-react-native-app

### **Then create a new react native project called text-reader**

    $ create-react-native-app text-reader && cd text-reader

### Install AWS Amplify in the react native project

    $ yarn add aws-amplify aws-amplify-react-native

### **Install AWS mobile CLI**

    $ npm i -g awsmobile-cli

### **You’ll need to configure the CLI to use your AWS credentials**

    $ awsmobile configure

### **Lets create a src directory where we’ll store some code later**

    $ mkdir src

### **Now setup the backend**

    $ aws mobile init

![](https://cdn-images-1.medium.com/max/3300/1*EEZMKJ5L7hX4uGNvSupVPg.png)

You’ll notice that will also generate a file within the src directory which will contain your configuration for your backend.

### **Enable the cloud api**

    $ awsmobile cloud-api enable && awsmobile push

### **Finally, we’ll set the appropriate permissions for AWS Rekognition.**

From the AWS console, navigate to IAM then select **roles**. Select the role name that was automatically created.

![](https://cdn-images-1.medium.com/max/3782/1*ZW5Hx-WRTNeobFifiWrQsQ.png)

In the permissions tab, press **Attach Policy**. In the search box, search for *rekognition. *We won’t worry about setting specific policies so we’ll just grant full access by using the [**AmazonRekognitionFullAccess](https://console.aws.amazon.com/iam/home?region=ap-southeast-2#/policies/arn%3Aaws%3Aiam%3A%3Aaws%3Apolicy%2FAmazonRekognitionFullAccess) **role. Select that role then click **Attach Policy**.
> Now that we have done the configuration we can move on with setting up the UI.

## **User Interface**

What we’ll do in this section is get the app up and running without any functionality and some fake data to start off with.

Lets start with installing react native elements.

    yarn add react-native-elements

**Lets get started creating our components**

We’ll create 3 components and save them in the /src directory.

The ConfidenceBadge component is a badge component we’ll use to display the confidence percentage of the text detection.

Both the ErrorMessage and the Loader components will be used to display an error message and loader respectively.

<iframe src="https://medium.com/media/cface997fac2359a2c7cf7d35bd270ba" frameborder=0></iframe>

We’ll now create a component that we’ll use to render our text detections. You’ll notice that there is an array of fake text detections which we will replace soon.

    src/[DetectedTextList.js](https://gist.github.com/glenbray/b1e12f0746471f8ff4c4b3e206a7d6c1)

<iframe src="https://medium.com/media/17f151b757cc48a83eac709b74d7f833" frameborder=0></iframe>

TextDetectingCamera component will handle capturing the image and the text detection (*in next section*).

    src/TextDetectingCamera.js

<iframe src="https://medium.com/media/2705086a4f8ec325493b24ccfec649a1" frameborder=0></iframe>

To wire them all together, replace App.js at the root of the project with the following code

<iframe src="https://medium.com/media/04b01502b15f9390318ebad444faa0e5" frameborder=0></iframe>

## **Text Detection with AWS Rekognition**

We’ll now add the functionality to perform text detection.

### **Update DetectedTextList**

We’ll first update the the component src/DetectedTextList.js

We can now remove the fake array we used earlier, then update the render method to accept the textDetections array as props.

![](https://cdn-images-1.medium.com/max/2048/1*qX_-_hLtISdhmQ1P5OjhYg.png)

**Determine your endpoint configuration for AWS Rekognition**

In the next section we’ll be adding functionality to send an image to AWS Rekognition. The code I provide below will be configured for the Australian ap-southeast-2 region so you’ll need to update the endpoints location to the appropriate region. You can find your endpoint here [https://docs.aws.amazon.com/general/latest/gr/rande.html](https://docs.aws.amazon.com/general/latest/gr/rande.html)

**AWS Rekognition API**

Create the following file. This will send a request to AWS rekognition with the base64 of the image.

    src/api.js

<iframe src="https://medium.com/media/f63aeaddd19bf923b92273009678d40c" frameborder=0></iframe>

In the previous section, I mentioned the endpoints need to be updated in the above code if you are not using the ap-southeast-2 region on AWS.

**Send photo to AWS Rekognition**

Finally we’ll update the component TextDetectingCamera to use the api when taking a picture.

Add the following import to the component:

    import { detectText } from "./api";

then replace the takePicture function with the following code:

![](https://cdn-images-1.medium.com/max/2792/1*AC5CCiC33t9SjJXZLMrbeg.png)

To run this project you’ll need a device as a camera is required. Run the following command:

    yarn run start

This will allow you to run the app through the app Expo.
> This app has not been tested against android.
