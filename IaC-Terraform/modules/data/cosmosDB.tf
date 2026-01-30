# ACCOUNT
resource "azurerm_cosmosdb_account" "cosmosdb-account" {
  name                = lower("${var.project_initials}${var.random_suffix}-appbe-cosmosdb")
  location            = var.location
  resource_group_name = var.deploy_rg
  offer_type          = "Standard"
  kind                = "MongoDB"

  automatic_failover_enabled = false
  public_network_access_enabled = false
  mongo_server_version = "7.0"

  capabilities {
    name = "EnableMongo"
  }

  capabilities {
    name = "MongoDBv3.4"
  }

  capabilities {
    name = "EnableServerless"
  }

  consistency_policy {
    consistency_level       = "Session"
    max_interval_in_seconds = 5
    max_staleness_prefix    = 100
  }

  geo_location {
    location          = var.location
    failover_priority = 0
  }

  tags = var.shared_tags
}

# DATABASE
resource "azurerm_cosmosdb_mongo_database" "cosmosdb-database" {
  name                = "healthcare-database"
  resource_group_name = var.deploy_rg
  account_name        = azurerm_cosmosdb_account.cosmosdb-account.name
}

# COLLECTION 1
resource "azurerm_cosmosdb_mongo_collection" "collection-patient" {
  name                = "patient"
  resource_group_name = var.deploy_rg
  account_name        = azurerm_cosmosdb_account.cosmosdb-account.name
  database_name       = azurerm_cosmosdb_mongo_database.cosmosdb-database.name
  
  index {
    keys   = ["_id"]
    unique = true
  }
  index {
    keys   = ["patientId"]
    unique = true
  }
}

# COLLECTION 2
resource "azurerm_cosmosdb_mongo_collection" "collection_appointment" {
  name                = "appointment"
  resource_group_name = var.deploy_rg
  account_name        = azurerm_cosmosdb_account.cosmosdb-account.name
  database_name       = azurerm_cosmosdb_mongo_database.cosmosdb-database.name
  
  index {
    keys   = ["_id"]
    unique = true
  }
}


# COLLECTION 3
resource "azurerm_cosmosdb_mongo_collection" "collection_report" {
  name                = "report"
  resource_group_name = var.deploy_rg
  account_name        = azurerm_cosmosdb_account.cosmosdb-account.name
  database_name       = azurerm_cosmosdb_mongo_database.cosmosdb-database.name
  
  index {
    keys   = ["_id"]
    unique = true
  }
}