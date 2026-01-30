#    Migration Plan: On-Prem to Azure

## Current On-Prem Scenario

1. Overview
    - Application Type:
    - Patient Management System hosted on hospital data center servers.

2. Components:
    - Frontend: Legacy web app (ASP.NET/Java) served via IIS.
    - Backend: Monolithic API handling:
      - Patient registration & records
      - Appointment scheduling
      - Billing & insurance
      - Notifications (SMS/email)
    - Database: On-prem relational database for patient records and appointments.
    - Authentication: Local Active Directory.
    - Configuration: Hardcoded in config files.
    - Monitoring: Basic server logs, no centralized observability.

3. Challenges:
    - Scalability issues for telemedicine and IoT integration.
    - Secrets stored insecurely in config files.
    - Downtime during updates.
    - Compliance gaps (HIPAA/GDPR).

## Azure Proposed Architecture

Architecture diagram of proposed solution
![Drawing of a Azure architecture diagram](/ArchitectureDrawing/AppDesign.png "Architecture Diagram")
Drawn with: [app.diagrams.net](https://app.diagrams.net/)

## Target Azure Architecture

1. Entry Point:
    - Create address on existing DNS Zone
    - Azure Application Gateway as secure entry point for frontend and APIs.

2. Frontend:
    - Azure Static Web Apps (React + TypeScript)

3. Backend APIs:
    - Azure Functions (JavaScript) for modular services with:
      - PatientService (CRUD for patient records)
      - AppointmentService (scheduling)
      - BillingService (payments)
      - NotificationService (SMS/email)
      - Configure Private Endpoint for secure communication with database.
      - Function logging is saved to Storage Account Container

4. Database:
    - Azure Cosmos DB (MongoDB API) for patient records and appointments.
    - Configure Private Endpoint for secure communication with Function App.

5. Secrets & Security:
    - Azure Key Vault for secrets.
    - Azure App Configuration integrated with Key Vault for live updates.  
    - Oauth 2.0 (OIDC) user authentication in frontend and backend application

6. Messaging/Queues:
    - Azure Service Bus queues:
      - appointment-confirmation → For appointment notifications.
      - billing-events → For asynchronous billing processing.  

7. Monitoring:  
    - Azure Monitor for infrastructure metrics.
    - Application Insights for API telemetry.

## Infrastructure Implementation Plan

### Stage 1: Foundation and Core Infrastructure

This stage establishes the secure network and essential management services, following the "security first" principle. 
  1. Identity and Access Management (IAM):
    - Configure Microsoft Entra ID (formerly Azure AD) for identity management.
    - Configure Service Principal and Enterprise Applciation.
    - Implement Role-Based Access Control (RBAC) with the principle of least privilege.  
  2. Networking Setup:
    - Design and deploy a Virtual Network (VNet) with appropriate subnets (e.g., Application Gateway subnet, Private Endpoint subnet).
    - Configure Network Security Groups (NSGs) to restrict network traffic between subnets.
  3. Key Management and Configuration:
    - Deploy User Managed Identity
    - Deploy Azure Key Vault to store secrets, keys, and certificates securely.
    - Deploy Azure App Configuration and integrate it with Key Vault for dynamic, live updates of application settings.        
    - Deploy Private Endpoint for App Configuration    

### Stage 2: Data Platform and Messaging Services

This stage focuses on deploying the data stores and messaging services that the backend APIs will utilize, securing them with private endpoints. 
  1. Database Deployment:
    - Deploy Azure Cosmos DB account (using MongoDB API).
    - Create necessary databases and collections for patient records and appointments.
    - Configure the Cosmos DB account with a Private Endpoint to restrict access solely within the VNet.
  2. Messaging Infrastructure:
    - Deploy Azure Service Bus namespace.
    - Create the required queues: appointment-confirmation and billing-events.
  3. Storage for Logging:
    - Deploy an Azure Storage Account with a dedicated container for function logging and other application data.

### Stage 3: Backend APIs (Azure Functions)

This stage involves deploying the backend services and establishing secure connectivity to the data plane. 
  1. Deploy Function Apps:
    - Create Azure Function Apps for each service: PatientService, AppointmentService, BillingService, and NotificationService.
  2. Configure Secure Connectivity:
    - Configure Private Endpoints for the Function Apps to enable secure, private communication with the Cosmos DB account.
    - Update DNS Zone with A records for the private endpoints to ensure correct name resolution.
  3. Code Deployment and Configuration:
    - Deploy the JavaScript function code for all services.
    - Configure application settings to retrieve connection strings and secrets from Key Vault via App Configuration.    

### Stage 4: Frontend and Entry Point

This stage exposes the application securely to the internet via the Application Gateway. 
  1. Deploy Frontend Application:
    - Deploy the Azure Static Web Apps (React + TypeScript).    
  2. Application Gateway Configuration:
    - Deploy Azure Application Gateway (v2 recommended) in its dedicated subnet.
    - Enable Web Application Firewall (WAF) on the Application Gateway to protect against common web exploits (OWASP top 10).
    - Configure listeners for HTTPS traffic (upload SSL certificates managed in Key Vault).
    - Define backend pools for the Azure Function Apps (via their private IP addresses) and the Azure Static Web App endpoint.
    - Set up routing rules to direct traffic to the appropriate backend services.
    - Add the custom address to the existing DNS Zone, pointing to the Application Gateway's public IP address. 

### Stage 5: Monitoring and Security

  1. Configure Monitoring
    - Configure Azure Monitor and Application Insights
    - Integrate all services with this two monitoring solutions
  2. Backend Security
    - Configure new backend App Registration for Authentication
    - Implement Oauth 2.0 (OIDC) authentication logic within the Azure Functions to validate tokens from the frontend. 
  3. Frontend Security
    - Configure new frontend App Registration for Authentiction
    - Implement Oauth 2.0 (OIDC) authentication logic in the frontend to acquire user tokens.

### Stage 6: Testing, Optimization, and Go-Live 

The final stage involves comprehensive testing and transition to production.   
  1. End-to-End Testing:
    - Perform full-stack testing, verifying connectivity, functionality, and security controls (e.g., ensuring WAF is blocking malicious requests).
    - Test OIDC authentication flow from frontend to backend APIs.
    - Verify asynchronous processing via Service Bus queues.
  2. Monitoring and Alerting:
    - Validate that all metrics and telemetry data are flowing into Azure Monitor and Application Insights.
    - Configure relevant alerts for potential issues (e.g., high CPU usage, failed requests, WAF blocks).
  3. Optimization and Reliability:
    - Review all deployed services against the WAF pillars (Security, Reliability, Cost Optimization, Operational Excellence, Performance Efficiency) using the Azure Well-Architected Review tool.
    - Implement a disaster recovery and business continuity plan, including regular backups for Cosmos DB.
  4. Production Cutover:
    - Update the DNS record to point production traffic to the Application Gateway public IP address if not already done. 

## Infrastructure Cost

- Service SKU Used
  - DNS Zone   | $0.50
  - Application Gateway Basic (no WAF) | $25.16
  - Static WebApp Standard | $9.00
  - Private Link x 5 | $38.50
  - Function App - SKU: Flex Consumptipon | $0.00
  - Service Bus - SKU: Basic | $0.00
  - Storage Account - SKU: Standard 100GB Hot | $1.84
  - Key Vault - SKU: Standard | $0.03
  - Cosmos DB with MongoDB API - SKU: Serverless | $0.50
  - App Configuration - SKU: Standard | $36.00
  - Monitor
    - Application Insights | $2.23
    - Notifications | $2.00

- TOTAL (DEV - Basic Services)
  - Monthly USD: 116.93
  - Monthly BRL: 631.42
  - Hourly USD: 0.16
  - Hourly BRL: 0.86
  - 8 hours BRL: 6.88

- TOTAL (PRODUCTION - App Gateway with WAF v2 and Service Bus Standard):
  - Monthly USD: 435.49
  - Monthly BRL: 2366.02
  - Hourly USD: 0.60
  - Hourly BRL: 3.26


TODO: List of ALL todo's
**NEXT**:
- storage queue - make appointment implementation
- implement communication services to send e-mail (see if sms and whatsapp)
- processing function for service bus sometimes processes same entry more than once. fix issue.
- website not rereshing authentication token automatically. see why.
**OTHERS**
- add communications service price to infra cost.

