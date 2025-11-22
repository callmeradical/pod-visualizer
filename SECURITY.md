# Security Policy

## Supported Versions

We currently provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| main    | :white_check_mark: |

## Security Features

This project implements several security best practices:

### Container Security
- **Multi-stage builds** for minimal attack surface
- **Non-root user** execution (UID 1001)
- **Read-only root filesystem**
- **Dropped capabilities** (ALL capabilities dropped)
- **Security contexts** enforced in Kubernetes

### Kubernetes Security
- **Minimal RBAC permissions** (only read access to pods/deployments)
- **Service Account** with explicit permissions
- **Security contexts** in pod specifications
- **Resource limits** to prevent resource exhaustion

### CI/CD Security
- **Automated vulnerability scanning** with Trivy
- **SARIF uploads** to GitHub Security tab
- **Container image scanning** for known vulnerabilities
- **Dependency scanning** for Go modules

## Reporting a Vulnerability

If you discover a security vulnerability, please follow these steps:

1. **DO NOT** open a public issue
2. Email the maintainers directly at: [security@your-domain.com]
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Suggested fix (if any)

### What to expect

- **Acknowledgment**: We'll acknowledge receipt within 48 hours
- **Initial assessment**: We'll provide an initial assessment within 5 business days
- **Updates**: We'll keep you informed of our progress
- **Resolution**: We aim to resolve critical vulnerabilities within 30 days

### Coordinated Disclosure

We follow responsible disclosure principles:
- We'll work with you to understand and validate the issue
- We'll develop and test a fix
- We'll coordinate the release of the fix and public disclosure
- We'll credit you for the discovery (if desired)

## Security Updates

Security updates are released as:
- **Patch releases** for supported versions
- **Security advisories** on GitHub
- **Updated container images** on DockerHub

Subscribe to GitHub notifications or watch the repository to stay informed about security updates.

## Security Scanning

Our CI/CD pipeline includes:
- **Source code scanning** with Trivy
- **Container image scanning** for vulnerabilities
- **Dependency scanning** for known CVEs
- **SARIF report uploads** to GitHub Security tab

## Best Practices for Deployment

When deploying this application:

1. **Use the latest version** available
2. **Enable network policies** in your Kubernetes cluster
3. **Use a dedicated namespace** with appropriate RBAC
4. **Monitor resource usage** and set appropriate limits
5. **Enable audit logging** in your cluster
6. **Keep your Kubernetes cluster updated**

## Contact

For security-related questions or concerns:
- Email: [security@your-domain.com]
- GitHub Security Advisories: Use the "Security" tab in the repository
