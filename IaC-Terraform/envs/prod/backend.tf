terraform {
  backend "azurerm" {
    resource_group_name   = "SharedResources"
    storage_account_name  = "ekbsharedstorage"
    container_name        = "tfstate-microprj"
    key                   = "prod_environment.tfstate"
  }
}
