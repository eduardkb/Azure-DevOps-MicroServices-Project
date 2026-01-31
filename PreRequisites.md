# Mandataory Configuration Before Deployment

## Storage Account

- A existing storage account with a container is needed to store terraform state
- Storage account RG, name and container names are configured in file `./IaC-terraform/envs/prod/backend.tf`
  - Current Names: resource group `SharedResources` storage `ekbsharedstorage` container `tfstate-microprj`

## DNS Zone
- A pre-configured public dns zone is necessary with its SSL certificate for DNS Zone and Key Vault step below
- modify the name of the Public DNS Zone on file `./IaC-terraform/modules/ingress/variables.tf` variable `imported_dns_zone_name`. Also modify variable `imported_resource_group` to inform where this resource is located.
- modify the prefix name (variable `dns_zone_prefix` on file above). Ex: www or app. If APEX, put '@'.
- Make sure on the recordsets of this DNS Zone there is no record with the prefix name above. It will be created.

## Frontend DNS Configuration
- On file `./IaC-terraform/modules/compute/static-webapp.tf` modify on line 12 the `VITE_BACKEND_API_URL` variable to correspond to the API URL that will be used by the frontend react application.

## Key Vault

- A separate keyvault is needed to store the SSL Certificate for the App Gateway and its secret
- make sure this key vault is configured on same resource group as storage account above for simplicity
- SSL Certificate:
  - on a pre-existing key vault import the password protected .pfx file to a Certificate in KeyVault
  - name it "appGateway-sslPfxCert" 
- Certificate Password
  - you don't need to create the password as a secret on keyvault. app gateway can read the certificate fom kv withou passing the password.
- Configure this key vault's name on the terraform file `./IaC-terraform/modules/security/variables.tf` variable `imported_keyvault`. also update the `imported_resource_group` with the resource group name where this Key Vault is located.

## App Registration / Enterprise Application for GitHub - Azure Access

- Create a App Registration and Enterprise Application
- Assign Role "Storage Blob Data Contributor" to this EA on the Storge Account above
  - This is needed so GitHub Actions can read and write to the terraform state file
- Assign Role "Storage Account Key Operator Service Role" to this EA on the Storge Account above
  - This is needed so GitHub Actions can read keys for the storage account
- Assign Role "Contributor" to this EA on the Resource Group where the Resources of this project will be deployed.
  - This is needed to create resources on the resource group
- Assign Role "User Access Administrator" to this EA on the Resource Group where the Resources of this project will be deployed.
  - This is needed because some resources permissions will need to be added (Example: Managed identity access for Database, Function and Key Vault)
- Configure "Federated Credentials" on App Reg's Certificates & Secrets screen
  - This is needed for all communications between GitHub Actions and Azure. (Example: to create resources with terraform and to deploy code to function app)
  - Configuration:
    - Credential Scenario = GitHub actions deploying Azure resources
    - Organization
    - Repository
    - Entity = Branch
    - Branch = main
    - name = 
- Subscriprion Resource Providers
  - Make sure resource provider `Microsoft.Web` and `Microsoft.Metwprl` are registered on the subscription where resources are being deployed
    - This is needed for Function App's VNet integration

## App Registration for Web App and API Authentication

- Create 2 App Registration and Enterprise Application. One for frontend, one for backend
If all scopes are admin granted, all scopes will be on the Access Token. not just the selected one in the access reqeust with scope. For this scenario, the backend application also needs roles and users assigned to those roles on the EA.
- On some tenants, the person who creates the App Reg and EA are not automatically added as owners.
  - Add your user account as owner on all two App Registrations and all two Enterprise Applications.
  - This is needed to add API Permissions to the web app registration from the api app registration.
- Backend:
  - Expose an API:
    - Add the default 'Application ID URI'
    - Add three Scopes. They are: api.readers, api.writers and api.admins. Make sure you select 'Admins and Users' on 'Who can consent'
  - Add Roles
    - Create three App Roles named: api.read, api.write and api.admin with Allowed member types = "Users/Groups".
    
- Frontend:
  - Authentication
    - Add URI Redirect and select Single-page application
    - Configure URL on Redirect URI (Ex.: https://edukb.site)
    - Configure URL on Redirect URI http://localhost:3000 for local development
    - Select both ID and Access Token checkbox and confirm.
  - App Roles
    - Create three App Roles named: app.read, app.write and app.admin with Allowed member types = "Users/Groups".
  - API Permissions
    - Add a Permisison -> My APIs -> Backend App Registration name
    - add all three Scopes created on Expose an API on the backend app registration on this front end app registration.
    - Grant admin consent for all three scopes added    
  - Terraform Parameters
    - Configure the WEB Client ID in file `./IaC-terraform/modules/security/variables.tf` variable `AppReg_WebClientID`.
    - Configure the API Client ID in file `./IaC-terraform/modules/security/variables.tf` variable `AppReg_ApiClientID`.
- Enterprise Application permission for both Frontend and Backend
  - Assigning groups to EA needs "Premium" license. If present:
    - Create EntraID groups named `MicroServProject-Read`, `MicroServProject-Write` and ``MicroServProject-Admin``
    - Assign members to each group according to what access each user should have
    - On each of the two Enterprise Applications (FE and BE):      
      - Go to Properties and modify "Assignment Required" to "yes"
      - Go to Users and Groups and add each group created on previous step here assigning the corresponding role.
  - If no Premium License:
    - On each of the two Enterprise Applications (FE and BE):      
      - Go to Properties and modify "Assignment Required" to "yes"
      - Go to Users and Groups and add users with their corresponding role


## GitHub Actions

- Configure Secrets to authenticate with Azure
  - AZURE_CLIENT_ID
  - AZURE_TENANT_ID
  - AZURE_SUBSCRIPTION_ID

