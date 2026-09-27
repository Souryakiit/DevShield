# DevShield Test Files

Demo files for DevShield video — DO NOT EXECUTE.

| File | Expected Signal | Risk |
|------|----------------|------|
| package.json | install_script + non_registry_dependency | HIGH |
| aws-config.py | hardcoded_secret (AWS key) | HIGH |
| deploy.sh | suspicious_network_call (reverse shell) | HIGH |
| loader.js | obfuscated_code + sql_injection_risk + xss_injection_risk | HIGH |
| github-token.env | hardcoded_secret (GitHub PAT + Stripe key) | HIGH |
| invoice.pdf.exe | double_extension | MEDIUM |
| utils.py | none | LOW |
