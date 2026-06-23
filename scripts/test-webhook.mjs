import axios from "axios";

async function test() {
  const url = "https://script.google.com/macros/s/AKfycbwEnTEo-5js7t_I2m2bI0tnL-I7_qAPhnkmVnSzbMPAXbC91xmlrl93bUJcC3gtQ7q7/exec";
  console.log("Testing POST request via Axios to:", url);
  try {
    const response = await axios.post(url, {
      leads: [
        {
          name: "Webhook Test Cafe",
          address: "Test Address",
          phone: "123",
          rating: "4.5",
          website: "http://test.com",
          ownerName: "TestOwner",
          email: "test@test.com",
          socialLink: "N/A",
          priority: "HIGH",
          status: "not_contacted",
          notes: "Testing webhook"
        }
      ],
      category: "test",
      location: "test"
    }, { timeout: 10000 });
    console.log("Response Status:", response.status);
    console.log("Response Data:", response.data);
  } catch (err) {
    console.error("Error code:", err.code);
    console.error("Error status:", err.response?.status);
    console.error("Error message:", err.message);
    if (err.response?.data) {
      console.error("Error data:", err.response.data.slice?.(0, 500) || err.response.data);
    }
  }
}

test();
