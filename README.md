[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# Maven Publish Action

**Automates Maven artifact deployment to Nexus with optional GPG signing**

## What It Does

- Runs the Maven `deploy` lifecycle phase against your project
- Feeds your GPG key and passphrase to `maven-gpg-plugin` so released artifacts are signed
- Supplies Nexus credentials so the staging plugin can upload and promote your project

If you have a `deploy` Maven profile defined, the action activates it automatically — handy for keeping deployment-only steps out of your regular build.

## Before You Begin

### 1. Create a Sonatype OSSRH Account

Publishing to Maven Central requires a Sonatype account and an approved group ID. Register at [Sonatype OSSRH](https://issues.sonatype.org/secure/Signup!default.jspa), then open a new repository request [here](https://issues.sonatype.org/secure/CreateIssue.jspa?issuetype=21&pid=10134). Approval typically takes one to two business days.

You can complete the remaining steps while you wait.

### 2. Generate a GPG Signing Key

Artifacts published to Maven Central must be signed. To create a new key:

```sh
# macOS only — install gnupg if not already present
brew install gnupg

# Generate the key pair
gpg --gen-key
```

Follow the prompts and choose a strong passphrase. Once created, publish the public key to a keyserver so Sonatype can verify it:

```sh
# List keys and note the ID of the one you just created
gpg --list-keys

# Upload the public key (replace KEY_ID with your key's ID)
gpg --keyserver hkps://keys.openpgp.org --send-keys KEY_ID
```

### 3. Configure Your `pom.xml`

Add the following to your project's POM. It sets up a `deploy` profile containing the source, Javadoc, and GPG plugins, and wires up the Nexus staging plugin with your distribution repository:

```xml
<project>
  <profiles>
    <profile>
      <id>deploy</id>
      <build>
        <plugins>

          <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-source-plugin</artifactId>
            <version>2.4</version>
            <executions>
              <execution>
                <id>attach-sources</id>
                <goals>
                  <goal>jar-no-fork</goal>
                </goals>
              </execution>
            </executions>
          </plugin>

          <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-javadoc-plugin</artifactId>
            <version>2.10.4</version>
            <executions>
              <execution>
                <id>attach-javadocs</id>
                <goals>
                  <goal>jar</goal>
                </goals>
              </execution>
            </executions>
          </plugin>

          <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-gpg-plugin</artifactId>
            <version>1.6</version>
            <executions>
              <execution>
                <id>sign-artifacts</id>
                <phase>verify</phase>
                <goals>
                  <goal>sign</goal>
                </goals>
                <configuration>
                  <!-- Use loopback so gpg does not open a pinentry dialog -->
                  <gpgArguments>
                    <arg>--pinentry-mode</arg>
                    <arg>loopback</arg>
                  </gpgArguments>
                </configuration>
              </execution>
            </executions>
          </plugin>

        </plugins>
      </build>
    </profile>
  </profiles>

  <build>
    <plugins>
      <plugin>
        <groupId>org.sonatype.plugins</groupId>
        <artifactId>nexus-staging-maven-plugin</artifactId>
        <version>1.6.8</version>
        <extensions>true</extensions>
        <configuration>
          <serverId>ossrh</serverId>
          <nexusUrl>https://oss.sonatype.org/</nexusUrl>
          <autoReleaseAfterClose>false</autoReleaseAfterClose>
        </configuration>
      </plugin>
    </plugins>
  </build>

  <distributionManagement>
    <snapshotRepository>
      <id>ossrh</id>
      <url>https://oss.sonatype.org/content/repositories/snapshots</url>
    </snapshotRepository>
  </distributionManagement>
</project>
```

> The Maven Deploy Plugin is not needed when using the Nexus Staging Plugin.

## GitHub Secrets

Navigate to your repository's **Settings → Secrets and variables → Actions** and add the following:

| Secret | Description |
|---|---|
| `nexus_username` | Your Sonatype account username (not your email address) |
| `nexus_password` | Your Sonatype account password or [auth token](https://solidsoft.wordpress.com/2015/09/08/deploy-to-maven-central-using-api-key-aka-auth-token/) |
| `gpg_private_key` | Exported armored private key (`gpg -a --export-secret-keys KEY_ID`) |
| `gpg_passphrase` | Passphrase protecting the GPG key |

GPG secrets are optional but strongly recommended for publishing to Maven Central.

## Workflow Setup

Create `.github/workflows/release.yml` in your repository:

```yml
name: Release

on:
  push:
    branches:
      - master

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v7

      - name: Set up Java and Maven
        uses: actions/setup-java@v6
        with:
          java-version: 11
          distribution: temurin

      - name: Publish Maven artifacts
        uses: step-security/action-maven-publish@v1
        with:
          nexus_username: ${{ secrets.nexus_username }}
          nexus_password: ${{ secrets.nexus_password }}
          gpg_private_key: ${{ secrets.gpg_private_key }}
          gpg_passphrase: ${{ secrets.gpg_passphrase }}
```

## Configuration Reference

| Input | Default | Description |
|---|---|---|
| `nexus_username` | — | Sonatype account username (**required**) |
| `nexus_password` | — | Sonatype account password or auth token (**required**) |
| `maven_goals_phases` | `clean deploy` | Maven goals and lifecycle phases to execute |
| `maven_profiles` | `deploy` | Comma-separated Maven profiles to activate |
| `maven_args` | `""` | Additional flags passed to the Maven command |
| `directory` | repo root | Path to the Maven project to deploy |
| `server_id` | `ossrh` | Server ID used in `nexus-staging-maven-plugin` and `distributionManagement` |
| `gpg_private_key` | — | Armored GPG private key for artifact signing (optional) |
| `gpg_passphrase` | — | Passphrase for the GPG key (required when key is provided) |


## References

- [Sonatype OSSRH Guide](https://central.sonatype.org/pages/ossrh-guide.html)
- [Working with PGP Signatures](https://central.sonatype.org/pages/working-with-pgp-signatures.html)
- [Publishing Artifacts to Maven Central](https://itnext.io/publishing-artifact-to-maven-central-b160634e5268)
