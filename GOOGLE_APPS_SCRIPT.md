# Google Sheets Integration - Method A (Google Apps Script Webhook)

This guide walks you through setting up a fully automated, **zero-credentials** Google Sheets export using **Google Apps Script**. 

No Google Cloud Console setup, API keys, or service account JSON files are needed!

---

## 📋 Steps to Set Up

### 1. Open Google Sheets & Create Webhook Script
1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet (or open an existing one).
2. Rename the first worksheet/tab to **`Sheet1`** if it's named differently.
3. In the top menu, click on **Extensions > Apps Script**.
4. Delete any existing code in the editor (`myFunction` block) and paste the following script:

```javascript
function doPost(e) {
  try {
    var jsonString = e.postData.contents;
    var data = JSON.parse(jsonString);
    var leads = data.leads;
    var category = data.category || "N/A";
    var location = data.location || "N/A";
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Add headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      var headers = [
        "Name", "Address", "Phone", "Rating", "Website", 
        "Category", "Location", "Owner Name", "Email", 
        "Social Link", "Priority", "Status", "Notes", "Date"
      ];
      sheet.appendRow(headers);
    }
    
    // Append each lead
    for (var i = 0; i < leads.length; i++) {
      var lead = leads[i];
      var row = [
        lead.name || "N/A",
        lead.address || "N/A",
        lead.phone || "N/A",
        lead.rating || "N/A",
        lead.website || "N/A",
        category,
        location,
        lead.ownerName || "N/A",
        lead.email || "N/A",
        lead.socialLink || "N/A",
        lead.priority || "LOW",
        lead.status || "not_contacted",
        lead.notes || "",
        new Date().toISOString()
      ];
      sheet.appendRow(row);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, count: leads.length }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
```

### 2. Save & Deploy the Script
1. Click the **Save** icon (disk floppy) in the toolbar.
2. Click the blue **Deploy** button in the top right and select **New deployment**.
3. Click the gear icon next to "Select type" and choose **Web app**.
4. Configure the settings:
   - **Description**: `LeadFinder Webhook`
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: **`Anyone`**  *(This is critical, otherwise the app won't be able to push to it!)*
5. Click **Deploy**.
6. Google will ask you to **Authorize Access**. Click **Authorize Access**, select your Google Account, click **Advanced** (at the bottom of the prompt), and then click **Go to Untitled project (unsafe)** to grant permissions.

### 3. Copy the URL & Update `.env`
1. Copy the **Web App URL** shown in the deployment confirmation modal. (It looks like `https://script.google.com/macros/s/AKfycb.../exec`).
2. Open your project's `.env` file and add the following line at the bottom:
   ```env
   GOOGLE_WEBHOOK_URL="PASTE_YOUR_WEB_APP_URL_HERE"
   ```

3. **Restart the Next.js app** so the new environment variable is loaded.

---

## 🚀 How to Use
Once configured:
- Clicking **Save to CRM & Google Sheets** or **Export Filtered to Sheets** in your dashboard will send your leads directly to the script, which appends them to your Google Sheet instantly.
