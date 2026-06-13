import { fetchApeeData } from './apeeDb';
import { loginAnonymously } from '../firebase'; // Import login function

async function testDbConnection() {
  try {
    // Authenticate anonymously before running the test
    console.log("Attempting to log in anonymously...");
    const user = await loginAnonymously();
    console.log("Logged in anonymously as user:", user.uid);

    // Use the authenticated user's ID for the test
    const testParentId = user.uid; 

    console.log(`Attempting to fetch data for parentId: ${testParentId}...`);
    const result = await fetchApeeData(testParentId);

    console.log("Test fetch completed.");

    if (result && (result.parents.length > 0 || result.settings.associationName !== "")) {
      console.log("SUCCESS: Data successfully fetched from Firestore:", result);
      console.log("Database connection is working correctly.");
    } else {
      console.warn("WARNING: Fetch was successful but returned no data. This could mean:");
      console.warn("1. The database is empty for the given parentId.");
      console.warn("2. There might be a logic error in the fetchApeeData function.");
    }
  } catch (error) {
    console.error("FAILURE: An error occurred while testing the database connection.");
    console.error(error);
  }
}

testDbConnection();
