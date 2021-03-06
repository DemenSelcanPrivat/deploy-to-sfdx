echo ".Profile: Updating PATH"
export PATH=$PATH:/app

echo ".Profile: Updating PATH to include Salesforce CLI ..."
export PATH=$PATH:/app/.local/share/sfdx/cli/bin/

# do not autoupdate
export SFDX_AUTOUPDATE_DISABLE=true
# new json settings
export SFDX_JSON_TO_STDOUT=true

echo ".Profile: Creating local resources ..."
mkdir /app/built/tmp
mkdir /app/tmp

echo ".Profile: Completed!"