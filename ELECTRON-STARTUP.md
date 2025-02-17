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

### Configuration Options

The electron app can be configured using `env-electron.json` in the root directory. There are two main modes:

1. **Production Mode** - Uses Auth0 authentication and remote database:
   ```json
   {
     "API_IDENTIFIER": "https://www.whetstone-writer.com/api",
     "AUTH0_DOMAIN": "your-tenant.auth0.com",
     "CLIENT_ID": "your-client-id",
     "MOCK_AUTH": false,
     "LOCAL_DB": false
   }
   ```

2. **Local Development Mode** - Uses mock authentication and local database:
   ```json
   {
     "API_IDENTIFIER": "https://www.whetstone-writer.com/api",
     "AUTH0_DOMAIN": "your-tenant.auth0.com",
     "CLIENT_ID": "your-client-id",
     "MOCK_AUTH": true,
     "LOCAL_DB": true
   }
   ```

When `MOCK_AUTH` is enabled:
- No Auth0 authentication is required
- A mock user is provided automatically
- The app skips the login process

When `LOCAL_DB` is enabled:
- Data is stored locally instead of in the remote database
- No internet connection is required
- Perfect for local development and testing

### Auth0 Configuration

If not using mock authentication (`MOCK_AUTH: false`), you'll need to set up Auth0:

1. Create an Auth0 account if you haven't already
2. Create a new API in Auth0:
   - Set the identifier to `https://www.whetstone-writer.com/api`
   - Use RS256 signing algorithm

3. Create a new Auth0 Application:
   - Set application type to "Native"
   - Add `http://localhost/callback*` to the Allowed Callback URLs
   - Note down the Client ID

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
5. Consider enabling `MOCK_AUTH: true` for local development 