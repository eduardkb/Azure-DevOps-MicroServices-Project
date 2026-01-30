output "storage_id" {
  value       = azurerm_storage_account.storage.id
}

output "storage_blob_endpoint" {
  value       = azurerm_storage_account.storage.primary_blob_endpoint	
}

output "storage_access_key" {
  value       = azurerm_storage_account.storage.primary_access_key
  sensitive   = true
}

output "storage_container_function" {
  value       = azurerm_storage_container.function-store.name
}

output "db_cosmosdb_id" {
  value       = azurerm_cosmosdb_account.cosmosdb-account.id
}

output "db_cosmosdb_name" {
  value       = azurerm_cosmosdb_account.cosmosdb-account.name
}

output "db_cosmosdb_conn_string" {
  value       = azurerm_cosmosdb_account.cosmosdb-account.primary_mongodb_connection_string
}

output "storage_servicebus_id" {
  value       = azurerm_servicebus_namespace.servicebus.id
}

output "storage_servicebus_conn_string" {
  value       = azurerm_servicebus_namespace.servicebus.default_primary_connection_string
}
