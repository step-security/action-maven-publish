const path = require("path");
const { writeFileSync, unlinkSync } = require("fs");
const { execSync } = require("child_process");
const { validateSubscription } = require("./subscription");

function resolveLocalPath(filename) {
	return path.join(__dirname, filename);
}

const settingsFilePath = resolveLocalPath("settings.xml");
const gpgKeyFile = resolveLocalPath("private-key.txt");

// Reads a raw environment variable by name
function readEnvVar(varName) {
	const { [varName]: envValue } = process.env;
	return envValue;
}

// Runs a shell command, inheriting stdio so output flows to the console
function executeCommand(cmd, workDir = null) {
	return execSync(cmd, { cwd: workDir, stdio: "inherit", encoding: "utf8" });
}

// Retrieves an action input by name; throws if the input is required but absent
function fetchInput(inputName, isRequired = false) {
	const val = readEnvVar(`INPUT_${inputName.toUpperCase()}`);
	if (val != null) return val;
	if (isRequired) throw new Error(`Required input "${inputName}" was not provided`);
	return null;
}

// Print a message to standard output
function printMessage(text) {
	console.log(text); // eslint-disable-line no-console
}

// Imports the GPG private key into the local keychain when one is supplied
function importGpgKey() {
	const gpgKey = fetchInput("gpg_private_key").trim();
	if (gpgKey.length === 0) return;

	fetchInput("gpg_passphrase", true);
	printMessage("Importing GPG private key…");
	writeFileSync(gpgKeyFile, gpgKey);
	executeCommand(`gpg --import --batch ${gpgKeyFile}`);
	unlinkSync(gpgKeyFile);
}

// Entry point: validates inputs, imports GPG key if provided, then runs the Maven deploy
async function deployMavenProject() {
	await validateSubscription();
	fetchInput("nexus_username", true);
	fetchInput("nexus_password", true);

	const additionalArgs = fetchInput("maven_args", true);
	const goals = fetchInput("maven_goals_phases", true);
	const profiles = fetchInput("maven_profiles", true);

	importGpgKey();

	// The "deploy" profile lets users gate steps to the deploy phase only
	printMessage("Running Maven deployment…");
	executeCommand(
		`mvn ${goals} --batch-mode --activate-profiles ${profiles} --settings ${settingsFilePath} ${additionalArgs}`,
		fetchInput("directory") || null,
	);
}

deployMavenProject();
