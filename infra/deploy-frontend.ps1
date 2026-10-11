param(
  [Parameter(Mandatory=$true)][string]$Bucket,
  [Parameter(Mandatory=$true)][string]$DistributionId,
  [Parameter(Mandatory=$true)][string]$AuthApiUrl,
  [Parameter(Mandatory=$true)][string]$CallbackUrl,
  [string]$Profile = 'default'
)
$ErrorActionPreference = 'Stop'
if ($Bucket -notmatch '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$') {throw 'Invalid S3 bucket name.'}
if ($DistributionId -notmatch '^[A-Z0-9]+$') {throw 'Invalid distribution ID.'}
if ($AuthApiUrl -notmatch '^https://[^/]+') {throw 'Backend URL must use HTTPS.'}
$env:VITE_AUTH_API_URL = $AuthApiUrl.TrimEnd('/')
if ($CallbackUrl -notmatch '^https://[^/]+') {throw 'Callback URL must use HTTPS and match the Cognito allowed callback URL.'}
$env:VITE_COGNITO_REDIRECT_URI = $CallbackUrl
$env:VITE_COGNITO_USER_POOL_ID = 'us-east-1_UOugaJlN8'
$env:VITE_COGNITO_USER_POOL_CLIENT_ID = '6rls971j2qq88nune9f74lukbc'
$env:VITE_COGNITO_DOMAIN = 'us-east-1uougajln8.auth.us-east-1.amazoncognito.com'
npm run build
if ($LASTEXITCODE -ne 0) {throw 'Frontend build failed.'}
# Upload hashed assets first, then HTML. Preserve unrelated bucket objects.
aws s3 sync dist/ "s3://$Bucket/" --exclude index.html --cache-control 'public,max-age=31536000,immutable' --profile $Profile
if ($LASTEXITCODE -ne 0) {throw 'Asset upload failed.'}
aws s3 cp dist/index.html "s3://$Bucket/index.html" --content-type text/html --cache-control 'no-cache,no-store,must-revalidate' --profile $Profile
if ($LASTEXITCODE -ne 0) {throw 'HTML upload failed.'}
aws cloudfront create-invalidation --distribution-id $DistributionId --paths '/index.html' '/' '/signin' '/dashboard' '/auth/callback' --profile $Profile
if ($LASTEXITCODE -ne 0) {throw 'CloudFront invalidation failed.'}
