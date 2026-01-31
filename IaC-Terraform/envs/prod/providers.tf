# Provider configuration
terraform {  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 4.54.0" 
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.7.2"
    }
  }
}

# Azure Provider Configuration
provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = false
    }
    app_configuration {
      purge_soft_delete_on_destroy = false
      recover_soft_deleted         = false
    }
  }
  resource_provider_registrations = "none"
  
  // Uncomment lines below to do local deploy
  # use_cli = true
  # subscription_id = "036934db-469c-4cee-b795-92c96dd7e29f"
}