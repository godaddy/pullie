[![Build Status](https://travis-ci.org/godaddy/pullie.svg?branch=master)](https://travis-ci.org/godaddy/pullie) [![Coverage Status](https://coveralls.io/repos/github/godaddy/pullie/badge.svg?branch=master)](https://coveralls.io/github/godaddy/pullie?branch=master)

[![NPM](https://nodei.co/npm/pullie.png?downloads=true&stars=true)](https://nodei.co/npm/pullie/)

# pullie

Pullie is a GitHub bot that makes your PRs better. It runs as a GitHub App and receives webhook calls whenever a pull
request is made against a repo on which the app is installed. Plugins provide handy functionality like linking to Jira
tickets, requesting reviews, and commenting about a missing required file change.

## System requirements

Pullie runs on public GitHub or on GitHub Enterprise 2.14 or later.

## How to run/deploy

The easiest way to deploy Pullie is to wrap this npm module in another package which includes the configuration files
and deployment logic.

A sample wrapper package is included in the `sample-deployment-wrapper/` folder. It uses Docker and Kubernetes, though
neither of those are hard requirements to run Pullie.

At a high level, the requirements are:

- Have [a configuration file](#configuration)
- Run the `pullie` bin script with `--configFile=<path to your config file>`

## Configuration

Your config file must be in JSON format and contain the following:

```js
{
  "http": 3000, // port to run on
  "github": {
    "apiUrl": "https://github.example.com/api/v3/", // base URL of your GitHub instance
    "client_id": "your app's client ID", // see section below
    "client_secret": "your app's client secret", // see section below
    "appId": "your app's ID", // see section below
    "appKeyPath": "/etc/pullie/pullie.private.pem", // path to your app's private key -- see section below
    "publicUrl": "https://github.example.com/github-apps/pullie", // URL to your app's public page
    "secret": "your app's webhook secret", // see section below
  },
  "jira": { // This section is optional -- only needed if you want to integrate with Jira
    "protocol": "https", // Protocol for Jira API
    "host": "jira.example.com", // Hostname for Jira API
    "username": "username of account with Jira access",
    "password": "password of account with Jira access",
    "apiVersion": 2, // API version to use when communicating with Jira
    "strictSSL": true // Whether to require strict SSL when communicating with Jira
  }
}
```

### Setting up your GitHub App

Pullie runs as a GitHub App, so if you are installing it on your own GitHub Enterprise instance, you must register a
GitHub App there first. Here's how:

1. Browse to your GHE server homepage
2. Go to your user icon in the top right and select **Settings** from the menu
3. Select **Developer Settings** on the left side
4. Select **GitHub Apps** on the left side
5. Press the **New GitHub App** button on the top right
6. Fill out the form as follows:

- **GitHub App name:** Pullie
- **Description (optional):** Pullie is a GitHub bot that makes your PRs better. It runs as a GitHub App and receives
  webhook calls whenever a pull request is made against a repo on which the app is installed. Plugins provide handy
  functionality like linking to Jira tickets, requesting reviews, and commenting about a missing required file change.
- **Homepage URL:** The base URL of your Pullie deployment (e.g. https://pullie.example.com)
- **User authorization callback URL:** Same URL as above
- **Setup URL (optional):** Not needed -- leave this blank
- **Webhook URL:** `/api/v1/github` appended to your deployment's base URL (e.g. https://pullie.example.com/api/v1/github)
- **Webhook secret (optional):** Choose a random string as your webhook secret (e.g. a random UUID perhaps)

- **Permissions:** Leave all as **No access** _except_ the following:
  - **Repository administration:** Read-only
  - **Repository contents:** Read-only
  - **Repository metadata:** Read-only
  - **Pull requests:** Read & write
  - **Single file:** Read-only for `.pullierc`
  - **Organization members:** Read-only

- **Subscribe to events:** Leave all unchecked _except_ **Pull request**

- **Where can this GitHub App be installed?** This is up to you. If you choose **Only on this account**, other users in
  your GHE instance will not see your application.

7. Press the **Create GitHub App** button
8. Now you have a GitHub App, so we need to collect some information to use in our configuration file:
  - Scroll to the bottom of the configuration page for your new GitHub App
  - Copy the **ID** and use as your app's ID in the config file
  - Copy the **Client ID** and use as your app's client ID in the config file
  - Copy the **Client secret** and use as your app's client secret in the config file
  - Click the **Generate private key** button to create your app's private key file. Copy the file it downloads to your
    Pullie deployment in a secure place (e.g. by using Kubernetes Secrets)
9. Upload a logo for Pullie. You can use one of the PNG files in the `dist` folder of the Pullie npm package if you'd like.

### Install your GitHub App on an org/user

Now, you can install your GitHub App on an org or user. Select **Install App** on the left side of the App's config page
and then press the green **Install** button on any org(s) and/or user(s) you'd like Pullie to run on. Pullie will not
do anything unless a repo has a `.pullierc` file, so it is safe to install across an org.

## User documentation

User docs are available at the base URL of your Pullie deployment (e.g https://pullie.example.com). Just browse there
and you'll see full documentation on installing the App and configuring a repo to work with it.
