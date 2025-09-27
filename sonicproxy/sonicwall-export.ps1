# sonicwall-export.ps1
$ip = "192.168.5.49"
$port = 443
$output = "sonicwall.crt"

# TLS-Handshake aufbauen und Zertifikat holen
$tcp = New-Object Net.Sockets.TcpClient($ip, $port)
$ssl = New-Object Net.Security.SslStream($tcp.GetStream(), $false,
    ({ $true } -as [Net.Security.RemoteCertificateValidationCallback]))
$ssl.AuthenticateAsClient($ip)

$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)

# Zertifikat als PEM speichern
$bytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$base64 = [System.Convert]::ToBase64String($bytes, "InsertLineBreaks")
$header = "-----BEGIN CERTIFICATE-----"
$footer = "-----END CERTIFICATE-----"
$pem = $header + "`r`n" + $base64 + "`r`n" + $footer

Set-Content -Path $output -Value $pem

Write-Host "Zertifikat exportiert nach $output"
