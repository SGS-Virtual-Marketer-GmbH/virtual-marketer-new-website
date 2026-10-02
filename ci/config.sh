# Shared settings for the build pipeline. Sourced by the ci/*.sh scripts and by ci/install.sh.
PROJECT=virtual-marketer-chat-bot
REGION=europe-west1
BUCKET=virtual-marketer-chat-bot-site-build
SERVICE=virtual-marketer-website
REPO_URL=https://github.com/SGS-Virtual-Marketer-GmbH/virtual-marketer-new-website.git
IMAGE_BASE=europe-west1-docker.pkg.dev/virtual-marketer-chat-bot/cloud-run-source-deploy/virtual-marketer-website
BUILDER_SA=vm-site-builder@virtual-marketer-chat-bot.iam.gserviceaccount.com
SCHEDULER_SA=vm-site-scheduler@virtual-marketer-chat-bot.iam.gserviceaccount.com
SCHEDULE='5 0,6,12,18 * * *'
SCHEDULE_TZ=Europe/Berlin
KEEP_IMAGES=5
