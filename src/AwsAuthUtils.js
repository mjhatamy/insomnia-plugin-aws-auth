/*
 * AwsAuthUtils.js (1/5/21, 9:29 PM)
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

const AWS   = require('aws-sdk');

class AwsAuthUtils {
    cognitoidentity
    constructor(awsRegion, awsAccessKeyId, awsSecretAccessKey) {
        AWS.config.update( { region: awsRegion } );
        if(typeof(awsAccessKeyId) !== 'undefined' && typeof(awsSecretAccessKey) !== 'undefined') {
            AWS.config.credentials = new AWS.Credentials(awsAccessKeyId, awsSecretAccessKey);
        }
        this.cognitoidentity = new AWS.CognitoIdentity({apiVersion: 'latest', region: awsRegion});
    }
    getCredentials() {
        const weakThis = this;
        return new Promise(async (resolve, reject) => {
            //new AWS.Credentials().get()

        })
    }

    getOpenIdTokenForDeveloperIdentity( userIdentity, awsIdentityPoolId, awsDevIdentityProvider ) {
        const weakThis = this;
        return new Promise((resolve, reject) => {
            let params = { IdentityPoolId: awsIdentityPoolId, /* required */
                Logins: { }
            };
            params.Logins[awsDevIdentityProvider] = userIdentity;
            weakThis.cognitoidentity.getOpenIdTokenForDeveloperIdentity(params, function (err, data) {
                if(err) { console.error(`getOpenIdTokenForDeveloperIdentity failed. error: ${JSON.stringify(err)}`);
                    reject(err);
                } else {
                    //console.log(`getOpenIdTokenForDeveloperIdentity Result: ${JSON.stringify(data)}`);
                    resolve(data);
                }
            });
        });
    }



    getCredentialsForIdentity( userCognitoIdentityId, userSessionToken ) {
        const weakThis = this;
        return new Promise((resolve, reject) => {
            const params = {
                IdentityId: `${userCognitoIdentityId}`,
                Logins: {"cognito-identity.amazonaws.com": userSessionToken}
            };
            weakThis.cognitoidentity.getCredentialsForIdentity(params, function (err, data) {
                if (err) {
                    console.error(`getCredentialsForIdentity failed. error: ${JSON.stringify(err)}`);
                    reject(err);
                } else {
                    //console.log(`getCredentialsForIdentity Result: ${JSON.stringify(data)}`);
                    resolve(data);
                }
            });
        });
    }
}


module.exports = AwsAuthUtils;