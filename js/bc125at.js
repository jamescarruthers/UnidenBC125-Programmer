/**
 * BC125AT Scanner Protocol Library
 * Implements the PC Programming Command protocol for the BC125AT Scanner
 */

class BC125AT {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.connected = false;
    this.programMode = false;
    
    // CTCSS/DCS code mappings
    this.ctcssCodes = this.initializeCTCSS();
    this.dcsCodes = this.initializeDCS();
  }

  /**
   * Connect to the scanner via serial port
   */
  async connect(port) {
    try {
      this.port = port;
      await this.port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
      
      this.reader = this.port.readable.getReader();
      this.writer = this.port.writable.getWriter();
      
      this.connected = true;
      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      return false;
    }
  }

  /**
   * Disconnect from the scanner
   */
  async disconnect() {
    try {
      if (this.programMode) {
        await this.exitProgramMode();
      }
      
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
      }
      
      if (this.writer) {
        await this.writer.close();
      }
      
      if (this.port) {
        await this.port.close();
      }
      
      this.connected = false;
      this.programMode = false;
      return true;
    } catch (error) {
      console.error('Disconnect failed:', error);
      return false;
    }
  }

  /**
   * Send a command and wait for response
   */
  async sendCommand(command) {
    if (!this.connected) {
      throw new Error('Not connected to scanner');
    }

    const commandBytes = new TextEncoder().encode(command + '\r');
    await this.writer.write(commandBytes);
    
    return await this.readResponse();
  }

  /**
   * Read response from scanner
   */
  async readResponse() {
    let response = '';
    
    while (true) {
      const { value, done } = await this.reader.read();
      if (done) break;
      
      const chunk = new TextDecoder().decode(value);
      response += chunk;
      
      if (response.includes('\r')) {
        break;
      }
    }
    
    return response.trim().replace(/\r$/, '');
  }

  /**
   * Enter Program Mode
   */
  async enterProgramMode() {
    try {
      const response = await this.sendCommand('PRG');
      if (response === 'PRG,OK') {
        this.programMode = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Enter program mode failed:', error);
      return false;
    }
  }

  /**
   * Exit Program Mode
   */
  async exitProgramMode() {
    try {
      const response = await this.sendCommand('EPG');
      if (response === 'EPG,OK') {
        this.programMode = false;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Exit program mode failed:', error);
      return false;
    }
  }

  /**
   * Get Model Information
   */
  async getModelInfo() {
    const response = await this.sendCommand('MDL');
    const parts = response.split(',');
    return parts.length > 1 ? parts[1] : null;
  }

  /**
   * Get Firmware Version
   */
  async getFirmwareVersion() {
    const response = await this.sendCommand('VER');
    const parts = response.split(',');
    return parts.length > 1 ? parts[1] : null;
  }

  /**
   * Get Channel Information
   */
  async getChannelInfo(index) {
    if (!this.programMode) {
      throw new Error('Must be in program mode to access channel info');
    }

    const response = await this.sendCommand(`CIN,${index}`);
    return this.parseChannelResponse(response);
  }

  /**
   * Set Channel Information
   */
  async setChannelInfo(channelData) {
    if (!this.programMode) {
      throw new Error('Must be in program mode to set channel info');
    }

    const command = this.formatChannelCommand(channelData);
    const response = await this.sendCommand(command);
    return response === 'CIN,OK';
  }

  /**
   * Get all channels (1-500)
   */
  async getAllChannels(progressCallback) {
    const channels = [];
    
    for (let i = 1; i <= 500; i++) {
      try {
        const channel = await this.getChannelInfo(i);
        channels.push(channel);
        
        if (progressCallback) {
          progressCallback(i, 500);
        }
      } catch (error) {
        console.error(`Failed to get channel ${i}:`, error);
        // Add empty channel to maintain index consistency
        channels.push(this.createEmptyChannel(i));
      }
    }
    
    return channels;
  }

  /**
   * Program all channels to scanner
   */
  async programAllChannels(channels, progressCallback) {
    let successCount = 0;
    
    for (let i = 0; i < channels.length && i < 500; i++) {
      try {
        const success = await this.setChannelInfo(channels[i]);
        if (success) successCount++;
        
        if (progressCallback) {
          progressCallback(i + 1, channels.length);
        }
      } catch (error) {
        console.error(`Failed to program channel ${i + 1}:`, error);
      }
    }
    
    return successCount;
  }

  /**
   * Delete Channel
   */
  async deleteChannel(index) {
    if (!this.programMode) {
      throw new Error('Must be in program mode to delete channel');
    }

    const response = await this.sendCommand(`DCH,${index}`);
    return response === 'DCH,OK';
  }

  /**
   * Parse channel response from scanner
   */
  parseChannelResponse(response) {
    const parts = response.split(',');
    if (parts.length < 8 || parts[0] !== 'CIN') {
      return null;
    }

    return {
      index: parseInt(parts[1]),
      name: parts[2],
      frequency: this.parseFrequency(parts[3]),
      modulation: parts[4],
      ctcssDcs: parseInt(parts[5]),
      delay: parseFloat(parts[6]),
      lockout: parseInt(parts[7]) === 1,
      priority: parseInt(parts[8]) === 1
    };
  }

  /**
   * Format channel data for command
   */
  formatChannelCommand(channelData) {
    const freq = this.formatFrequency(channelData.frequency);
    const ctcssDcs = channelData.ctcssDcs || 0;
    const delay = channelData.delay || 0;
    const lockout = channelData.lockout ? 1 : 0;
    const priority = channelData.priority ? 1 : 0;

    return `CIN,${channelData.index},${channelData.name},${freq},${channelData.modulation},${ctcssDcs},${delay},${lockout},${priority}`;
  }

  /**
   * Convert frequency from Hz to MHz
   */
  parseFrequency(freqHz) {
    return parseInt(freqHz) / 10000;
  }

  /**
   * Convert frequency from MHz to Hz
   */
  formatFrequency(freqMHz) {
    return Math.round(freqMHz * 10000);
  }

  /**
   * Create empty channel structure
   */
  createEmptyChannel(index) {
    return {
      index: index,
      name: '',
      frequency: 0,
      modulation: 'AUTO',
      ctcssDcs: 0,
      delay: 0,
      lockout: false,
      priority: false
    };
  }

  /**
   * Get CTCSS frequency by code
   */
  getCTCSSFrequency(code) {
    return this.ctcssCodes[code] || null;
  }

  /**
   * Get DCS code by index
   */
  getDCSCode(code) {
    return this.dcsCodes[code] || null;
  }

  /**
   * Get CTCSS/DCS display text
   */
  getCTCSSDCSText(code) {
    if (code === 0) return 'NONE';
    if (code === 127) return 'SEARCH';
    if (code === 240) return 'NO_TONE';
    
    const ctcss = this.getCTCSSFrequency(code);
    if (ctcss) return `${ctcss}Hz`;
    
    const dcs = this.getDCSCode(code);
    if (dcs) return `DCS ${dcs}`;
    
    return 'UNKNOWN';
  }

  /**
   * Initialize CTCSS code mappings
   */
  initializeCTCSS() {
    return {
      64: 67.0, 65: 69.3, 66: 71.9, 67: 74.4, 68: 77.0, 69: 79.7, 70: 82.5,
      71: 85.4, 72: 88.5, 73: 91.5, 74: 94.8, 75: 97.4, 76: 100.0, 77: 103.5,
      78: 107.2, 79: 110.9, 80: 114.8, 81: 118.8, 82: 123.0, 83: 127.3,
      84: 131.8, 85: 136.5, 86: 141.3, 87: 146.2, 88: 151.4, 89: 156.7,
      90: 159.8, 91: 162.2, 92: 165.5, 93: 167.9, 94: 171.3, 95: 173.8,
      96: 177.3, 97: 179.9, 98: 183.5, 99: 186.2, 100: 189.9, 101: 192.8,
      102: 196.6, 103: 199.5, 104: 203.5, 105: 206.5, 106: 210.7, 107: 218.1,
      108: 225.7, 109: 229.1, 110: 233.6, 111: 241.8, 112: 250.3, 113: 254.1
    };
  }

  /**
   * Initialize DCS code mappings
   */
  initializeDCS() {
    return {
      128: '023', 129: '025', 130: '026', 131: '031', 132: '032', 133: '036',
      134: '043', 135: '047', 136: '051', 137: '053', 138: '054', 139: '065',
      140: '071', 141: '072', 142: '073', 143: '074', 144: '114', 145: '115',
      146: '116', 147: '122', 148: '125', 149: '131', 150: '132', 151: '134',
      152: '143', 153: '145', 154: '152', 155: '155', 156: '156', 157: '162',
      158: '165', 159: '172', 160: '174', 161: '205', 162: '212', 163: '223',
      164: '225', 165: '226', 166: '243', 167: '244', 168: '245', 169: '246',
      170: '251', 171: '252', 172: '255', 173: '261', 174: '263', 175: '265',
      176: '266', 177: '271', 178: '274', 179: '306', 180: '311', 181: '315',
      182: '325', 183: '331', 184: '332', 185: '343', 186: '346', 187: '351',
      188: '356', 189: '364', 190: '365', 191: '371', 192: '411', 193: '412',
      194: '413', 195: '423', 196: '431', 197: '432', 198: '445', 199: '446',
      200: '452', 201: '454', 202: '455', 203: '462', 204: '464', 205: '465',
      206: '466', 207: '503', 208: '506', 209: '516', 210: '523', 211: '526',
      212: '532', 213: '546', 214: '565', 215: '606', 216: '612', 217: '624',
      218: '627', 219: '631', 220: '632', 221: '654', 222: '662', 223: '664',
      224: '703', 225: '712', 226: '723', 227: '731', 228: '732', 229: '734',
      230: '743', 231: '754'
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BC125AT;
} else if (typeof window !== 'undefined') {
  window.BC125AT = BC125AT;
}