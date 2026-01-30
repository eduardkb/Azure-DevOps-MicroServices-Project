terraform {
  backend "azurerm" {
    resource_group_name   = "rg-Eduard"
    storage_account_name  = "saeduardussc"
    container_name        = "tfstate-microprj"
    key                   = "prod_environment.tfstate"
  }
}
