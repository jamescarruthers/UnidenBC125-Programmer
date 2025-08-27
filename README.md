# Uniden BC125* programmer

A web-based programmer for the Uniden BC125AT, BC125XLT, BC125XLTC scanners using the Web Serial API.

## Features

- **Serial Communication**: Connect to your BC125* scanner via USB/serial
- **Channel Management**: Read, edit, and program all 500 channels
- **Spreadsheet Interface**: View and edit channels in a compact, table-like format
- **CSV Import/Export**: Save and load channel configurations
- **Real-time Programming**: Program channels directly to the scanner
- **Scanner Information**: Display model and firmware version
- **Frequency Display**: Frequencies shown and edited in MHz format
- **Advanced Filtering**: Search channels by name or frequency

## Browser Requirements

This application requires a browser with Web Serial API support:
- Google Chrome (version 89+)
- Microsoft Edge (version 89+)
- Other Chromium-based browsers

**Note**: Firefox and Safari are not currently supported due to lack of Web Serial API support.

## Setup

1. Clone or download this repository
2. Serve the files using a local web server (required for Web Serial API)

### Option 1: Using Python (if installed)
```bash
cd BC125AT-Programmer
python3 -m http.server 8080
```

### Option 2: Using Node.js (if installed)
```bash
cd BC125AT-Programmer
npm install
npm run serve
```

### Option 3: Using Live Server (VS Code extension)
- Install the "Live Server" extension in VS Code
- Right-click on `index.html` and select "Open with Live Server"

3. Open your browser and navigate to `http://localhost:8080`

## Usage

### Initial Connection

1. **Select COM Port**: Click "Select COM Port" to choose the serial port your scanner is connected to
2. **Connect**: Click "Connect" to establish communication with the scanner
3. The application will automatically enter Program Mode and display the scanner's model and firmware version

### Reading Channels

1. Click "Read Channels" to download all 500 channels from the scanner
2. Progress will be displayed as channels are read
3. Channels will be displayed in the table once reading is complete

### Editing Channels

1. Click the "Edit" button for any channel row
2. Modify the channel parameters:
   - **Name**: Up to 16 characters
   - **Frequency**: In MHz (e.g., 154.340)
   - **Modulation**: AUTO, AM, FM, or NFM
   - **CTCSS/DCS**: Select from dropdown list
   - **Delay**: -10s to 5s
   - **Lockout**: Enable/disable channel lockout
   - **Priority**: Enable/disable priority scanning
3. Click "Save" to update the channel or "Delete" to clear it

### Programming Channels

1. After editing channels, click "Program to Scanner" to upload all changes
2. Confirm the operation (this will overwrite all channels on the scanner)
3. Progress will be displayed during programming

### CSV Import/Export

**Export:**
- Click "Export CSV" to save all channels to a CSV file
- The file includes all channel data in a spreadsheet-compatible format

**Import:**
- Click "Import CSV" to load channels from a previously exported CSV file
- The CSV format must match the exported format
- Invalid rows will be skipped

### Filtering and Search

- Use the search box to filter channels by name or frequency
- Toggle "Show empty channels" to hide/show unused channels
- Filters work in real-time as you type

## CSV Format

The CSV export/import uses the following format:

```csv
Channel,Name,Frequency_MHz,Modulation,CTCSS_DCS,Delay,Lockout,Priority
1,"LOCAL PD",154.340000,FM,"CTCSS 67.0Hz",2,No,Yes
2,"FIRE DEPT",154.280000,FM,NONE,0,No,No
...
```

## Protocol Implementation

This application implements the BC125AT PC Programming Command protocol as documented in the scanner manual. Key features:

- **Command Structure**: All commands follow the documented format with proper error handling
- **Program Mode**: Automatically enters/exits program mode for memory operations  
- **CTCSS/DCS Support**: Full implementation of all CTCSS tones and DCS codes
- **Error Handling**: Proper response validation and error reporting
- **Frequency Conversion**: Automatic conversion between Hz (protocol) and MHz (user interface)

## Troubleshooting

### Connection Issues
- Ensure the scanner is powered on and connected via USB
- Make sure no other software is using the serial port
- Try disconnecting and reconnecting the USB cable
- Check that the scanner is not in menu mode

### Browser Compatibility
- Ensure you're using a Chromium-based browser
- Check that the site is served over HTTPS or localhost
- Web Serial API requires a secure context

### Programming Issues
- Verify the scanner is in Program Mode (should show "Remote Mode")
- Ensure the connection is stable during operations
- Large operations (reading/programming all channels) can take several minutes

## Technical Details

- **Protocol**: BC125AT PC Programming Commands
- **Baud Rate**: 9600 bps, 8 data bits, 1 stop bit, no parity
- **Command Format**: ASCII text commands terminated with carriage return (\\r)
- **Channels**: Supports all 500 memory channels
- **Frequency Range**: 25-512 MHz (as supported by scanner hardware)

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## Disclaimer

This software is not affiliated with or endorsed by Bearcat/Uniden. Use at your own risk. Always backup your scanner configuration before making changes.
