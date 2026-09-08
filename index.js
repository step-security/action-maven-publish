const path = require("path");
const { execFileSync } = require("child_process");
const { validateSubscription } = require("./subscription");

function resolveLocalPath(filename) {
	return path.join(__dirname, filename);
}

const settingsFilePath = resolveLocalPath("settings.xml");

// Reads a raw environment variable by name
function readEnvVar(varName) {
	const { [varName]: envValue } = process.env;
	return envValue;
}

// Runs a program with an explicit args array — no shell, no injection surface
function executeCommand(program, args, workDir = null) {
	return execFileSync(program, args, { cwd: workDir, stdio: "inherit", encoding: "utf8" });
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

// Imports the GPG private key into the local keychain when one is supplied.
// The key is piped via stdin — it never touches the filesystem.
function importGpgKey() {
	const gpgKey = fetchInput("gpg_private_key").trim();
	if (gpgKey.length === 0) return;

	fetchInput("gpg_passphrase", true);
	printMessage("Importing GPG private key…");
	execFileSync("gpg", ["--import", "--batch"], {
		input: gpgKey,
		stdio: ["pipe", "inherit", "inherit"],
	});
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
		"mvn",
		[
			...goals.trim().split(/\s+/).filter(Boolean),
			"--batch-mode",
			"--activate-profiles", profiles,
			"--settings", settingsFilePath,
			...additionalArgs.trim().split(/\s+/).filter(Boolean),
		],
		fetchInput("directory") || null,
	);
}

deployMavenProject();
