/*
 * plugin.js (1/5/21, 9:40 PM)
 *
 * MIT License
 * Copyright (c) 2021, Marands, Inc. Majid Hatami (mjhatamy@gmail.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Written by Majid Hatami <info@marands.io>, 1 2021
 */

const aws4  = require('aws4');
const URL   = require('url');
const AwsAuthUtils = require('./AwsAuthUtils');

let requestSigningParams = {
    userToken: null,
    userIdentityId: null,
    awsRegion: null,
    awsService: null,
    path: null,
    sessionToken: null,
    accessKeyId: null,
    secretKey: null
};

// Workspace actions are exported as an array of objects
module.exports.workspaceActions = [
    {
        label: "Reload Credentials",
        icon: 'fa-star',
        action: async (context, models) => {
            const ex = await context.data.export.insomnia({
                includePrivate: false,
                format: 'json',
                workspace: models.workspace,
            });
            //fs.WriteFileSync('/users/user/Desktop/export.json', ex);
        }
    }
];

module.exports.requestGroupActions = [
    {
        label: 'Refresh AWS Token',
        action: async (context, data) => {
            const { requests } = data;

            let results = [];
            for (const request of requests) {
                const response = await context.network.sendRequest(request);
                results.push(`<li>${request.name}: ${response.statusCode}</li>`);
            }

            const html = `<ul>${results.join('\n')}</ul>`;

            context.app.dialog('Results', { html });
        },
    },
];

module.exports.requestHooks = [ async (context) => {
    console.log("Request Hook");
    const requestSigningParamsString = await context.store.getItem("AwsUserSigningParams");
    if(typeof(requestSigningParamsString) === 'undefined'){
        throw Error(`Context.Store.getItem does not contain key: 'AwsUserSigningParams' `);
    }
    let requestSigningParams = null;
    try {
        requestSigningParams = JSON.parse(requestSigningParamsString);
    }catch (e) {
        console.error(`Failed to parse results. error: ${JSON.stringify(e)}`);
        throw e;
    }
    //console.log(`requestSigningParams: ${JSON.stringify(requestSigningParams)}`);
    let reqUrl = context.request.getUrl();
    let uriParsed = URL.parse(reqUrl);

    let request = {};//new AWS.HttpRequest('https://lkbvznwvbnczbhltef34jpe27m.appsync-api.us-west-2.amazonaws.com/graphql', signingParam.region);
    request.headers = {};
    request.method = context.request.getMethod();
    request.path = uriParsed.path;
    request.region = requestSigningParams.awsRegion;
    request.headers.host = uriParsed.host;
    request.headers['X-Amz-Security-Token'] = requestSigningParams.sessionToken;
    request.body = context.request.getBodyText();
    request.service = 'appsync';
    if(context.request.hasHeader('Content-Type')){
        request.headers['Content-Type'] = context.request.getHeader('Content-Type');
    }

    let signingKeys = {accessKeyId: requestSigningParams.accessKeyId, secretAccessKey: requestSigningParams.secretKey};
    let signedParam = aws4.sign(request, signingKeys);



    if (context.request.getMethod().toUpperCase() === 'POST') {
        context.request.setHeader('Content-Type', 'application/json');
        context.request.setHeader('Authorization', signedParam.headers.Authorization);
        context.request.setHeader('X-Amz-Security-Token', signedParam.headers['X-Amz-Security-Token']);
        context.request.setHeader('X-Amz-Date', signedParam.headers["X-Amz-Date"]);
        context.request.setHeader('host', signedParam.headers.host);
    }
}];




// Main run function
const run = async (context, userIdentity, password, awsIdentityPoolId, awsDevIdentityProvider, awsRegion, awsService, awsAccessKeyId, awsSecretAccessKey) => {
    if(typeof(awsAccessKeyId) !== 'undefined') {
        if(awsAccessKeyId.length <= 0) {
            awsAccessKeyId = undefined;
        }
    }
    if(typeof(awsSecretAccessKey) !== 'undefined') {
        if(awsSecretAccessKey.length <= 0) {
            awsSecretAccessKey = undefined;
        }
    }

    console.log(`Run arguments: \n
            userIdentity: ${userIdentity}
            password: ${password}
            awsIdentityPoolId: ${awsIdentityPoolId}
            awsDevIdentityProvider: ${awsDevIdentityProvider}
            awsRegion: ${awsRegion}
            awsService: ${awsService}
            accessKeyId: ${awsAccessKeyId}
            secretAccessKey: ${awsSecretAccessKey}`);

    if(typeof(userIdentity) === 'undefined') {
        throw Error('userIdentity must not be null or empty.')
    }
    if(typeof(password) === 'undefined') {
        throw Error('Password must not be null or empty.')
    }
    if(typeof(awsIdentityPoolId) === 'undefined') {
        throw Error('awsIdentityPoolId must not be null or empty.')
    }
    if (typeof(awsDevIdentityProvider) === 'undefined') {
        throw Error('AwsDevIdentityProvider must not be null or empty.')
    }
    if (typeof(awsRegion) === 'undefined') {
        console.error(`AwsRegion must not be null or empty. current value is : ${awsRegion}`);
        throw Error('AwsRegion must not be null or empty.')
    }

    let awsUtil = new AwsAuthUtils(awsRegion, awsAccessKeyId, awsSecretAccessKey);

    try {
        let resultTokenId = await awsUtil.getOpenIdTokenForDeveloperIdentity(userIdentity, awsIdentityPoolId, awsDevIdentityProvider);
        let userCredentialData = await awsUtil.getCredentialsForIdentity(resultTokenId.IdentityId, resultTokenId.Token);

        requestSigningParams.awsRegion = awsRegion;
        requestSigningParams.awsService = awsService;
        requestSigningParams.userToken = resultTokenId.Token;
        requestSigningParams.userIdentityId = resultTokenId.IdentityId;
        requestSigningParams.sessionToken = userCredentialData.Credentials.SessionToken;
        requestSigningParams.accessKeyId = userCredentialData.Credentials.AccessKeyId;
        requestSigningParams.secretKey = userCredentialData.Credentials.SecretKey;
        console.log("Saving requestSigningParam set.\nValue:", JSON.stringify(requestSigningParams, null, 4));
    } catch (e) {

        console.error("Failed due to error:" + e)
        //throw e;
    }

    console.log("Saving requestSigningParam set.\nValue:", JSON.stringify(requestSigningParams, null, 4));
    await context.store.setItem("AwsUserSigningParams", JSON.stringify(requestSigningParams));
    return JSON.stringify(requestSigningParams, null, 4);
};

module.exports.templateTags = [{
    name: 'AWSAuth',
    displayName: 'AWS Cognito Token (With support of Developer identities)',
    description: 'AWS Authentication Cognito Plugin for Insomnia to provide token from AWS',
    args: [
        {
            displayName: 'UserIdentity',
            type: 'string',
            defaultValue: "19257053143:0094a8d7abedc8d31e3463ae",
            validate: arg => (arg ? '' : 'Required')
        },
        {
            displayName: 'Password',
            type: 'string',
            defaultValue: "e9c9b5409006fb8fc11df783",
            validate: arg => (arg ? '' : 'Required')
        },
        {
            displayName: 'AwsIdentityPoolId',
            type: 'string',
            defaultValue: "us-west-2:e140dd9a-1219-4678-ab65-eee8530a99bd",
            validate: arg => (arg ? '' : 'Required')
        },
        {
            displayName: 'AwsDevIdentityProvider',
            type: 'string',
            defaultValue: "login.mygix.com",
            validate: arg => (arg ? '' : 'Required')
        },
        {
            displayName: 'AwsRegion',
            type: 'enum',
            defaultValue: "us-west-2",
            options: [
                {
                    displayName: "us-west-1",
                    value: "us-west-1",
                    description: "US West (N. California)"
                },
                {
                    displayName: "us-west-2",
                    value: "us-west-2",
                    description: "US West (Oregon)"
                },
                {
                    displayName: "af-south-1",
                    value: "af-south-1",
                    description: "Africa (Cape Town)"
                },
                {
                    displayName: "ap-east-1",
                    value: "ap-east-1",
                    description: "Asia Pacific (Hong Kong)"
                },
                {
                    displayName: "ap-south-1",
                    value: "ap-south-1",
                    description: "Asia Pacific (Mumbai)"
                },
                {
                    displayName: "ap-northeast-3",
                    value: "ap-northeast-3",
                    description: "Asia Pacific (Osaka-Local)"
                },
                {
                    displayName: "ap-northeast-2",
                    value: "ap-northeast-2",
                    description: "Asia Pacific (Seoul)"
                },
                {
                    displayName: "ap-northeast-1",
                    value: "ap-northeast-1",
                    description: "Asia Pacific (Tokyo)"
                },
                {
                    displayName: "ap-southeast-1",
                    value: "ap-southeast-1",
                    description: "Asia Pacific (Singapore)"
                },
                {
                    displayName: "ap-southeast-2",
                    value: "ap-southeast-2",
                    description: "Asia Pacific (Sydney)"
                },
                {
                    displayName: "ca-central-1",
                    value: "ca-central-1",
                    description: "Canada (Central)"
                },
                {
                    displayName: "eu-central-1",
                    value: "eu-central-1",
                    description: "Europe (Frankfurt)"
                },
                {
                    displayName: "eu-west-1",
                    value: "eu-west-1",
                    description: "Europe (Ireland)"
                },
                {
                    displayName: "eu-west-2",
                    value: "eu-west-2",
                    description: "Europe (London)"
                },
                {
                    displayName: "eu-south-1",
                    value: "eu-south-1",
                    description: "Europe (Milan)"
                },
                {
                    displayName: "eu-west-3",
                    value: "eu-west-3",
                    description: "Europe (Paris)"
                },
                {
                    displayName: "eu-north-1",
                    value: "eu-north-1",
                    description: "Europe (Stockholm)"
                },
                {
                    displayName: "me-south-1",
                    value: "me-south-1",
                    description: "Middle East (Bahrain)"
                },
                {
                    displayName: "sa-east-1",
                    value: "sa-east-1",
                    description: "South America (São Paulo)"
                }
            ],
            validate: arg => (arg ? '' : 'Required')
        },
        {
            displayName: 'AwsService',
            type: 'enum',
            defaultValue: "appsync",
            options: [
                {
                    displayName: "AWS AppSync",
                    value: "appsync",
                    description: "AWS App Sync GraphQL"
                }
            ],
            validate: arg => (arg ? '' : 'Required')

        },
        {
            displayName: "AWS Credential - Access Key Id",
            type: 'string',
            defaultValue: null,
            placeholder: "Use system default credentials"
        },
        {
            displayName: "AWS Credential - Secret Access Key",
            type: 'string',
            defaultValue: null,
            placeholder: "Use system default credentials"
        },
        {
            displayName: "Auth Type",
            type: 'enum',
            defaultValue: 'OpenIdTokenDeveloperIdentity',
            options: [
                {
                    displayName: "OpenId Token Developer Identity",
                    value: "OpenIdTokenDeveloperIdentity",
                    description: "Registers (or retrieves) a Cognito IdentityId and an OpenID Connect token for a user authenticated by your backend authentication process"
                },
                {
                    displayName: "Open Id Token",
                    value: "OpenIdToken",
                    description: "Gets an OpenID token, using a known Cognito ID."
                }
            ]
        }
    ],
    run
}];