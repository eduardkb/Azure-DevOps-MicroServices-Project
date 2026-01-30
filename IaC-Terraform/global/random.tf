# Random 3 letters for name of resources
resource "random_string" "three_letters" {
  length  = 3
  lower   = true   # include lowercase a–z
  upper   = false  # exclude uppercase
  numeric = false  # exclude 0–9
  special = false  # exclude special characters
}

# Random key for static web app
resource "random_id" "hex_256" {
  byte_length = 32  # 32 bytes = 256 bits
}