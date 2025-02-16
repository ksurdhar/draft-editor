# Electron App Startup Guide

## Prerequisites

### Python Setup
The electron app requires Python for building native dependencies. To set up Python:

1. Create a Python virtual environment in the project directory:
   ```bash
   python3 -m venv .venv
   ```

2. Activate the virtual environment:
   ```bash
   source .venv/bin/activate
   ```

3. Install required Python packages:
   ```bash
   python3 -m pip install setuptools wheel
   ```

### Auth0 Configuration

The electron app uses Auth0 for authentication. You'll need to set up the following:

1. Create an Auth0 account if you haven't already
2. Create a new API in Auth0:
   - Set the identifier to `https://www.whetstone-writer.com/api`
   - Use RS256 signing algorithm

3. Create a new Auth0 Application:
   - Set application type to "Native"
   - Add `http://localhost/callback*` to the Allowed Callback URLs
   - Note down the Client ID

4. Create an `env-electron.json` file in the root directory with the following structure:
   ```json
   {
     "API_IDENTIFIER": "https://www.whetstone-writer.com/api",
     "AUTH0_DOMAIN": "your-tenant.auth0.com",
     "CLIENT_ID": "your-client-id"
   }
   ```
   Replace `your-tenant.auth0.com` with your Auth0 domain and `your-client-id` with the Client ID from step 3.

## Starting the App

1. Install npm dependencies if you haven't already:
   ```bash
   npm install
   ```

2. Start the electron app in development mode:
   ```bash
   npm run edev
   ```

## Troubleshooting

### Native Dependencies
If you encounter errors related to native dependencies or `node-gyp`:
1. Ensure you have the Python virtual environment activated
2. Try cleaning and reinstalling dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm cache clean --force
   npm install
   ```

### Auth0 Issues
If you encounter authentication errors:
1. Verify your Auth0 configuration in `env-electron.json`
2. Ensure your Auth0 application is set up as a Native application
3. Confirm the callback URL is correctly set in Auth0
4. Check that your API identifier matches exactly what's in Auth0 