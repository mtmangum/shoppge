#!/usr/bin/env python3
"""Start, stop, or inspect the separately provisioned AWS test instance."""
import argparse
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import time
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('action', choices=['start', 'stop', 'status'])
args = parser.parse_args()
directory = Path.home() / '.config/pge-shop-test'
state_file = directory / 'environment.json'
if not state_file.exists():
    parser.error(f'Deployment state is missing: {state_file}')
state = json.loads(state_file.read_text())
local_cli = Path.home() / '.local/aws-cli/aws'
cli = os.environ.get('AWS_CLI') or (str(local_cli) if local_cli.exists() else shutil.which('aws'))
if not cli:
    parser.error('AWS CLI is not installed')


def aws(*arguments):
    return json.loads(subprocess.check_output([
        cli, '--profile', state['profile'], '--region', state['region'],
        *arguments, '--output', 'json', '--no-cli-pager',
    ]))


def instance():
    result = aws('ec2', 'describe-instances', '--instance-ids', state['instance_id'])
    return result['Reservations'][0]['Instances'][0]


identity = aws('sts', 'get-caller-identity')
if identity['Account'] != state['account']:
    raise SystemExit('The AWS profile points to a different account; no changes made.')

if args.action == 'stop':
    aws('ec2', 'stop-instances', '--instance-ids', state['instance_id'])
    print('Stop requested. Database, attachments, and test emails remain on the disk.')
    print('EBS disk storage remains billable while stopped.')
    raise SystemExit(0)

if args.action == 'start':
    current = instance()
    if current['State']['Name'] == 'stopped':
        aws('ec2', 'start-instances', '--instance-ids', state['instance_id'])
    elif current['State']['Name'] not in ('running', 'pending'):
        raise SystemExit(f"Instance is {current['State']['Name']}; wait and retry.")
    for _ in range(120):
        current = instance()
        if current['State']['Name'] == 'running' and current.get('PublicIpAddress'):
            break
        time.sleep(5)
    else:
        raise SystemExit('Timed out waiting for the instance; inspect its status.')
    cidr = urllib.request.urlopen('https://checkip.amazonaws.com', timeout=15).read().decode().strip() + '/32'
    if cidr != state['access_cidr']:
        def rules(address):
            return [{'IpProtocol': 'tcp', 'FromPort': port, 'ToPort': port,
                     'IpRanges': [{'CidrIp': address}]} for port in (22, 443, 8443)]
        aws('ec2', 'authorize-security-group-ingress', '--group-id', state['security_group'],
            '--ip-permissions', json.dumps(rules(cidr)))
        aws('ec2', 'revoke-security-group-ingress', '--group-id', state['security_group'],
            '--ip-permissions', json.dumps(rules(state['access_cidr'])))
        state['access_cidr'] = cidr
        state_file.write_text(json.dumps(state, indent=2) + '\n')
    ip = current['PublicIpAddress']
    state['public_ip'] = ip
    state_file.write_text(json.dumps(state, indent=2) + '\n')
    ssh = ['ssh', '-i', state['key_file'], '-o', 'StrictHostKeyChecking=accept-new',
           '-o', f'UserKnownHostsFile={directory / "known_hosts"}',
           '-o', 'ConnectTimeout=10', f'ubuntu@{ip}']
    for _ in range(60):
        if subprocess.run([*ssh, 'true'], stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL).returncode == 0:
            break
        time.sleep(5)
    else:
        raise SystemExit('Instance started, but SSH is unavailable.')
    update = """from pathlib import Path
import re
p = Path('/home/ubuntu/pge-shop-test/.env')
text = p.read_text()
for key, value in {'NEXTAUTH_URL': 'https://__PUBLIC_ADDRESS__', 'TEST_PUBLIC_IP': '__PUBLIC_ADDRESS__'}.items():
    if re.search(r'^' + key + r'=', text, flags=re.M):
        text = re.sub(r'^' + key + r'=.*$', key + '=' + value, text, flags=re.M)
    else:
        text += '\\n' + key + '=' + value + '\\n'
p.write_text(text)
""".replace('__PUBLIC_ADDRESS__', ip)
    command = ('python3 -c ' + shlex.quote(update) +
               ' && cd /home/ubuntu/pge-shop-test && docker compose -f docker-compose.test.yml up -d')
    subprocess.run([*ssh, command], check=True)
    for _ in range(60):
        try:
            with urllib.request.urlopen(f'https://{ip}/', timeout=5) as response:
                if response.status == 200:
                    break
        except (OSError, TimeoutError):
            pass
        time.sleep(5)
    else:
        raise SystemExit('Containers started, but the homepage did not become healthy.')

current = instance()
print(f"{state['instance_id']}: {current['State']['Name']}")
if current.get('PublicIpAddress'):
    ip = current['PublicIpAddress']
    print(f'App: https://{ip}/')
    print(f'Captured emails: https://{ip}:8443/')
print(f"Access: {state['access_cidr']}")
