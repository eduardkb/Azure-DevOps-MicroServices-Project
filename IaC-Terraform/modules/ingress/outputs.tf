output "ingress_api_fqdn" {
  value = trimsuffix(azurerm_dns_a_record.appgw_dns.fqdn, ".")
}