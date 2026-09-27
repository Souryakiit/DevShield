# AWS Configuration Manager - DEMO FILE (DevShield test)
import boto3

# Demo: hardcoded credential pattern - triggers hardcoded_secret signal
AWS_ACCESS_KEY_ID = "AKIADEMO" + "FAKEID1234ABCDEF"
AWS_REGION = "us-east-1"
password = "demopassword123"
api_key = "sk_demo_notreal_1234567890abcdef"

def get_s3_client():
    return boto3.client('s3', aws_access_key_id=AWS_ACCESS_KEY_ID, region_name=AWS_REGION)
