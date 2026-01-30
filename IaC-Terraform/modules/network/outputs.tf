output "network_integ_subnet_id" {
  value       = data.azapi_resource.integ_subnet.id
}

output "network_gw_subnet_id" {
  value       = data.azapi_resource.gw_subnet.id
}
