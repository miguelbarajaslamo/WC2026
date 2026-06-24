function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parts(name: string) {
  return normalizeName(name).split(/[\s-]+/).filter(Boolean);
}

function lastNamePart(nameParts: string[]) {
  return nameParts[nameParts.length - 1] ?? "";
}

export function playerNamesMatch(eventName: string | undefined, lineupName: string) {
  if (!eventName) {
    return false;
  }

  const eventNormalized = normalizeName(eventName);
  const lineupNormalized = normalizeName(lineupName);

  if (!eventNormalized || !lineupNormalized) {
    return false;
  }

  if (eventNormalized === lineupNormalized) {
    return true;
  }

  const eventParts = parts(eventName);
  const lineupParts = parts(lineupName);
  const eventLastName = lastNamePart(eventParts);
  const lineupLastName = lastNamePart(lineupParts);

  if (!eventLastName || eventLastName !== lineupLastName) {
    return false;
  }

  if (eventParts.length === 1) {
    return true;
  }

  const eventFirstName = eventParts[0] ?? "";
  const lineupFirstName = lineupParts[0] ?? "";

  if (!eventFirstName || !lineupFirstName) {
    return false;
  }

  if (eventFirstName.length === 1) {
    return lineupFirstName.startsWith(eventFirstName);
  }

  if (lineupFirstName.length === 1) {
    return eventFirstName.startsWith(lineupFirstName);
  }

  return eventFirstName === lineupFirstName;
}
