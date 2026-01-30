resource "azurerm_storage_account" "storage" {
  name                     = lower("${var.project_initials}${var.random_suffix}storage")  
  resource_group_name      = var.deploy_rg
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  public_network_access_enabled   = true
  allow_nested_items_to_be_public = false
  
  tags = var.shared_tags
}

resource "azurerm_storage_container" "function-store" {
  name                  = "function-store"
  storage_account_id    = azurerm_storage_account.storage.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "function-log" {
  name                  = "function-log"
  storage_account_id    = azurerm_storage_account.storage.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "patient-files" {
  name                  = "patient-files"
  storage_account_id    = azurerm_storage_account.storage.id
  container_access_type = "private"
}

resource "azurerm_storage_queue" "storage_appointment_queue" {
  name                 = "appointmentqueue"
  storage_account_id = azurerm_storage_account.storage.id  
}