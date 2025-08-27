/**
 * BC125AT Programmer Web Application
 * Main application controller
 */

class BC125ATApp {
  constructor() {
    this.scanner = new BC125AT();
    this.channels = [];
    this.selectedPort = null;
    this.currentEditingChannel = null;
    
    this.initializeElements();
    this.attachEventListeners();
    this.checkWebSerialSupport();
    this.populateCTCSSDCSOptions();
  }

  /**
   * Initialize DOM element references
   */
  initializeElements() {
    this.elements = {
      // Connection controls
      selectPortBtn: document.getElementById('selectPort'),
      connectBtn: document.getElementById('connect'),
      disconnectBtn: document.getElementById('disconnect'),
      connectionStatus: document.getElementById('connectionStatus'),
      scannerInfo: document.getElementById('scannerInfo'),
      modelInfo: document.getElementById('modelInfo'),
      firmwareInfo: document.getElementById('firmwareInfo'),
      
      // Channel controls
      readChannelsBtn: document.getElementById('readChannels'),
      programChannelsBtn: document.getElementById('programChannels'),
      progress: document.getElementById('progress'),
      progressFill: document.getElementById('progressFill'),
      progressText: document.getElementById('progressText'),
      
      // Import/Export
      importCSVBtn: document.getElementById('importCSV'),
      exportCSVBtn: document.getElementById('exportCSV'),
      fileInput: document.getElementById('fileInput'),
      
      // Table and filtering
      channelTable: document.getElementById('channelTable'),
      channelTableBody: document.getElementById('channelTableBody'),
      channelFilter: document.getElementById('channelFilter'),
      showEmpty: document.getElementById('showEmpty'),
      
      // Modal
      editModal: document.getElementById('editModal'),
      editChannelNumber: document.getElementById('editChannelNumber'),
      editChannelForm: document.getElementById('editChannelForm'),
      editName: document.getElementById('editName'),
      editFrequency: document.getElementById('editFrequency'),
      editModulation: document.getElementById('editModulation'),
      editCTCSSDCS: document.getElementById('editCTCSSDCS'),
      editDelay: document.getElementById('editDelay'),
      editLockout: document.getElementById('editLockout'),
      editPriority: document.getElementById('editPriority'),
      saveChannelBtn: document.getElementById('saveChannel'),
      deleteChannelBtn: document.getElementById('deleteChannel'),
      closeModalBtns: document.querySelectorAll('.close, .close-modal')
    };
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Connection events
    this.elements.selectPortBtn.addEventListener('click', () => this.selectPort());
    this.elements.connectBtn.addEventListener('click', () => this.connect());
    this.elements.disconnectBtn.addEventListener('click', () => this.disconnect());
    
    // Channel operations
    this.elements.readChannelsBtn.addEventListener('click', () => this.readAllChannels());
    this.elements.programChannelsBtn.addEventListener('click', () => this.programAllChannels());
    
    // Import/Export
    this.elements.importCSVBtn.addEventListener('click', () => this.elements.fileInput.click());
    this.elements.exportCSVBtn.addEventListener('click', () => this.exportToCSV());
    this.elements.fileInput.addEventListener('change', (e) => this.importFromCSV(e));
    
    // Filtering
    this.elements.channelFilter.addEventListener('input', () => this.filterChannels());
    this.elements.showEmpty.addEventListener('change', () => this.filterChannels());
    
    // Modal events
    this.elements.saveChannelBtn.addEventListener('click', () => this.saveChannelEdit());
    this.elements.deleteChannelBtn.addEventListener('click', () => this.deleteChannelEdit());
    
    // Close modal events
    this.elements.closeModalBtns.forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });
    
    // Close modal on outside click
    this.elements.editModal.addEventListener('click', (e) => {
      if (e.target === this.elements.editModal) {
        this.closeModal();
      }
    });
  }

  /**
   * Check if Web Serial API is supported
   */
  checkWebSerialSupport() {
    if (!('serial' in navigator)) {
      alert('Web Serial API is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.');
      this.elements.selectPortBtn.disabled = true;
    }
  }

  /**
   * Populate CTCSS/DCS options in the edit modal
   */
  populateCTCSSDCSOptions() {
    const select = this.elements.editCTCSSDCS;
    
    // Add CTCSS options
    Object.entries(this.scanner.ctcssCodes).forEach(([code, freq]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = `CTCSS ${freq}Hz`;
      select.appendChild(option);
    });
    
    // Add DCS options
    Object.entries(this.scanner.dcsCodes).forEach(([code, dcs]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = `DCS ${dcs}`;
      select.appendChild(option);
    });
  }

  /**
   * Select COM port
   */
  async selectPort() {
    try {
      this.selectedPort = await navigator.serial.requestPort();
      this.elements.connectBtn.disabled = false;
      this.showStatus('Port selected', 'info');
    } catch (error) {
      console.error('Port selection failed:', error);
      this.showStatus('Port selection cancelled', 'error');
    }
  }

  /**
   * Connect to scanner
   */
  async connect() {
    if (!this.selectedPort) {
      this.showStatus('No port selected', 'error');
      return;
    }

    this.showProgress(true, 'Connecting...');
    
    try {
      const success = await this.scanner.connect(this.selectedPort);
      if (success) {
        await this.scanner.enterProgramMode();
        await this.updateScannerInfo();
        this.updateConnectionUI(true);
        this.showStatus('Connected', 'success');
      } else {
        this.showStatus('Connection failed', 'error');
      }
    } catch (error) {
      console.error('Connection error:', error);
      this.showStatus('Connection error: ' + error.message, 'error');
    } finally {
      this.showProgress(false);
    }
  }

  /**
   * Disconnect from scanner
   */
  async disconnect() {
    try {
      await this.scanner.disconnect();
      this.updateConnectionUI(false);
      this.showStatus('Disconnected', 'info');
    } catch (error) {
      console.error('Disconnect error:', error);
      this.showStatus('Disconnect error: ' + error.message, 'error');
    }
  }

  /**
   * Update scanner info display
   */
  async updateScannerInfo() {
    try {
      const model = await this.scanner.getModelInfo();
      const firmware = await this.scanner.getFirmwareVersion();
      
      this.elements.modelInfo.textContent = `Model: ${model}`;
      this.elements.firmwareInfo.textContent = `Firmware: ${firmware}`;
      this.elements.scannerInfo.style.display = 'block';
    } catch (error) {
      console.error('Failed to get scanner info:', error);
    }
  }

  /**
   * Update connection UI state
   */
  updateConnectionUI(connected) {
    this.elements.connectBtn.disabled = connected;
    this.elements.disconnectBtn.disabled = !connected;
    this.elements.readChannelsBtn.disabled = !connected;
    this.elements.programChannelsBtn.disabled = !connected || this.channels.length === 0;
    
    const status = this.elements.connectionStatus;
    status.textContent = connected ? 'Connected' : 'Disconnected';
    status.className = `status ${connected ? 'connected' : 'disconnected'}`;
    
    if (!connected) {
      this.elements.scannerInfo.style.display = 'none';
    }
  }

  /**
   * Read all channels from scanner
   */
  async readAllChannels() {
    this.showProgress(true, 'Reading channels...');
    
    try {
      this.channels = await this.scanner.getAllChannels((current, total) => {
        const percent = Math.round((current / total) * 100);
        this.updateProgress(percent, `Reading channel ${current}/${total}`);
      });
      
      this.displayChannels();
      this.elements.exportCSVBtn.disabled = false;
      this.elements.programChannelsBtn.disabled = false;
      this.showStatus(`Read ${this.channels.length} channels`, 'success');
    } catch (error) {
      console.error('Failed to read channels:', error);
      this.showStatus('Failed to read channels: ' + error.message, 'error');
    } finally {
      this.showProgress(false);
    }
  }

  /**
   * Program all channels to scanner
   */
  async programAllChannels() {
    if (!confirm('This will overwrite all channels on the scanner. Continue?')) {
      return;
    }

    this.showProgress(true, 'Programming channels...');
    
    try {
      const successCount = await this.scanner.programAllChannels(this.channels, (current, total) => {
        const percent = Math.round((current / total) * 100);
        this.updateProgress(percent, `Programming channel ${current}/${total}`);
      });
      
      this.showStatus(`Programmed ${successCount}/${this.channels.length} channels`, 'success');
    } catch (error) {
      console.error('Failed to program channels:', error);
      this.showStatus('Failed to program channels: ' + error.message, 'error');
    } finally {
      this.showProgress(false);
    }
  }

  /**
   * Display channels in table
   */
  displayChannels() {
    const tbody = this.elements.channelTableBody;
    tbody.innerHTML = '';
    
    this.channels.forEach(channel => {
      const row = this.createChannelRow(channel);
      tbody.appendChild(row);
    });
    
    this.filterChannels();
  }

  /**
   * Create table row for channel
   */
  createChannelRow(channel) {
    const row = document.createElement('tr');
    row.className = channel.name || channel.frequency > 0 ? '' : 'empty';
    row.dataset.channelIndex = channel.index;
    
    row.innerHTML = `
      <td>${channel.index}</td>
      <td class="editable-cell" data-field="name">${channel.name || ''}</td>
      <td class="editable-cell" data-field="frequency">${channel.frequency > 0 ? channel.frequency.toFixed(6) : ''}</td>
      <td class="editable-cell" data-field="modulation">${channel.modulation}</td>
      <td class="editable-cell" data-field="ctcssDcs">${this.scanner.getCTCSSDCSText(channel.ctcssDcs)}</td>
      <td class="editable-cell" data-field="delay">${channel.delay}s</td>
      <td class="checkbox-cell" data-field="lockout"><span class="checkbox-indicator ${channel.lockout ? 'checked' : 'unchecked'}">${channel.lockout ? '✓' : '✗'}</span></td>
      <td class="checkbox-cell" data-field="priority"><span class="checkbox-indicator ${channel.priority ? 'checked' : 'unchecked'}">${channel.priority ? '✓' : '✗'}</span></td>
      <td><button class="delete-btn" onclick="app.deleteChannelRow(${channel.index})">Delete</button></td>
    `;
    
    // Add click handlers for inline editing
    this.addInlineEditHandlers(row, channel);
    
    return row;
  }

  /**
   * Filter channels based on search and show empty checkbox
   */
  filterChannels() {
    const filter = this.elements.channelFilter.value.toLowerCase();
    const showEmpty = this.elements.showEmpty.checked;
    const rows = this.elements.channelTableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
      const isEmpty = row.classList.contains('empty');
      const name = row.cells[1].textContent.toLowerCase();
      const frequency = row.cells[2].textContent;
      
      const matchesFilter = !filter || 
        name.includes(filter) || 
        frequency.includes(filter);
      
      const shouldShow = (showEmpty || !isEmpty) && matchesFilter;
      
      row.classList.toggle('hidden', !shouldShow);
    });
  }

  /**
   * Edit channel
   */
  editChannel(channelIndex) {
    const channel = this.channels.find(ch => ch.index === channelIndex);
    if (!channel) return;
    
    this.currentEditingChannel = channel;
    
    // Populate form
    this.elements.editChannelNumber.textContent = channelIndex;
    this.elements.editName.value = channel.name || '';
    this.elements.editFrequency.value = channel.frequency || '';
    this.elements.editModulation.value = channel.modulation;
    this.elements.editCTCSSDCS.value = channel.ctcssDcs;
    this.elements.editDelay.value = channel.delay;
    this.elements.editLockout.checked = channel.lockout;
    this.elements.editPriority.checked = channel.priority;
    
    // Show modal
    this.elements.editModal.style.display = 'block';
  }

  /**
   * Save channel edit
   */
  async saveChannelEdit() {
    if (!this.currentEditingChannel) return;
    
    const updatedChannel = {
      ...this.currentEditingChannel,
      name: this.elements.editName.value.trim(),
      frequency: parseFloat(this.elements.editFrequency.value) || 0,
      modulation: this.elements.editModulation.value,
      ctcssDcs: parseInt(this.elements.editCTCSSDCS.value),
      delay: parseFloat(this.elements.editDelay.value),
      lockout: this.elements.editLockout.checked,
      priority: this.elements.editPriority.checked
    };
    
    // Update local data
    const index = this.channels.findIndex(ch => ch.index === this.currentEditingChannel.index);
    if (index !== -1) {
      this.channels[index] = updatedChannel;
    }
    
    // Update table
    this.displayChannels();
    this.closeModal();
    
    this.showStatus(`Channel ${updatedChannel.index} updated`, 'success');
  }

  /**
   * Delete channel edit
   */
  async deleteChannelEdit() {
    if (!this.currentEditingChannel) return;
    
    if (!confirm(`Delete channel ${this.currentEditingChannel.index}?`)) return;
    
    const emptyChannel = this.scanner.createEmptyChannel(this.currentEditingChannel.index);
    
    // Update local data
    const index = this.channels.findIndex(ch => ch.index === this.currentEditingChannel.index);
    if (index !== -1) {
      this.channels[index] = emptyChannel;
    }
    
    // Update table
    this.displayChannels();
    this.closeModal();
    
    this.showStatus(`Channel ${this.currentEditingChannel.index} deleted`, 'success');
  }

  /**
   * Delete/clear a channel row
   */
  deleteChannelRow(channelIndex) {
    if (!confirm(`Clear channel ${channelIndex}?`)) return;
    
    const emptyChannel = this.scanner.createEmptyChannel(channelIndex);
    
    // Update local data
    const index = this.channels.findIndex(ch => ch.index === channelIndex);
    if (index !== -1) {
      this.channels[index] = emptyChannel;
    }
    
    // Update table
    this.displayChannels();
    
    this.showStatus(`Channel ${channelIndex} cleared`, 'success');
  }

  /**
   * Close modal
   */
  closeModal() {
    this.elements.editModal.style.display = 'none';
    this.currentEditingChannel = null;
  }

  /**
   * Export channels to CSV
   */
  exportToCSV() {
    const headers = ['Channel', 'Name', 'Frequency_MHz', 'Modulation', 'CTCSS_DCS', 'Delay', 'Lockout', 'Priority'];
    const rows = [headers];
    
    this.channels.forEach(channel => {
      rows.push([
        channel.index,
        channel.name || '',
        channel.frequency || '',
        channel.modulation,
        this.scanner.getCTCSSDCSText(channel.ctcssDcs),
        channel.delay,
        channel.lockout ? 'Yes' : 'No',
        channel.priority ? 'Yes' : 'No'
      ]);
    });
    
    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bc125at_channels.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showStatus('Channels exported to CSV', 'success');
  }

  /**
   * Import channels from CSV
   */
  async importFromCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.replace(/^"|"$/g, '')));
      
      // Skip header row
      const dataRows = rows.slice(1).filter(row => row.length >= 8 && row[0]);
      
      dataRows.forEach(row => {
        const channelIndex = parseInt(row[0]);
        if (channelIndex >= 1 && channelIndex <= 500) {
          const existingIndex = this.channels.findIndex(ch => ch.index === channelIndex);
          const channel = {
            index: channelIndex,
            name: row[1] || '',
            frequency: parseFloat(row[2]) || 0,
            modulation: row[3] || 'AUTO',
            ctcssDcs: this.parseCTCSSDCSFromText(row[4]),
            delay: parseFloat(row[5]) || 0,
            lockout: row[6].toLowerCase() === 'yes',
            priority: row[7].toLowerCase() === 'yes'
          };
          
          if (existingIndex !== -1) {
            this.channels[existingIndex] = channel;
          } else {
            this.channels.push(channel);
          }
        }
      });
      
      // Sort channels by index
      this.channels.sort((a, b) => a.index - b.index);
      
      // Ensure we have all 500 channels
      for (let i = 1; i <= 500; i++) {
        if (!this.channels.find(ch => ch.index === i)) {
          this.channels.push(this.scanner.createEmptyChannel(i));
        }
      }
      
      this.channels.sort((a, b) => a.index - b.index);
      this.displayChannels();
      this.elements.programChannelsBtn.disabled = false;
      
      this.showStatus(`Imported ${dataRows.length} channels from CSV`, 'success');
    } catch (error) {
      console.error('CSV import failed:', error);
      this.showStatus('CSV import failed: ' + error.message, 'error');
    }
    
    // Clear file input
    event.target.value = '';
  }

  /**
   * Parse CTCSS/DCS code from text representation
   */
  parseCTCSSDCSFromText(text) {
    if (!text || text === 'NONE') return 0;
    if (text === 'SEARCH') return 127;
    if (text === 'NO_TONE') return 240;
    
    // CTCSS frequency
    const ctcssMatch = text.match(/(\d+\.?\d*)Hz/);
    if (ctcssMatch) {
      const freq = parseFloat(ctcssMatch[1]);
      for (const [code, f] of Object.entries(this.scanner.ctcssCodes)) {
        if (Math.abs(f - freq) < 0.1) return parseInt(code);
      }
    }
    
    // DCS code
    const dcsMatch = text.match(/DCS (\d+)/);
    if (dcsMatch) {
      const dcs = dcsMatch[1];
      for (const [code, d] of Object.entries(this.scanner.dcsCodes)) {
        if (d === dcs) return parseInt(code);
      }
    }
    
    return 0;
  }

  /**
   * Show progress indicator
   */
  showProgress(show, text = '') {
    this.elements.progress.style.display = show ? 'flex' : 'none';
    if (show) {
      this.updateProgress(0, text);
    }
  }

  /**
   * Update progress bar
   */
  updateProgress(percent, text) {
    this.elements.progressFill.style.width = `${percent}%`;
    this.elements.progressText.textContent = text || `${percent}%`;
  }

  /**
   * Show status message
   */
  showStatus(message, type) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // You could implement toast notifications here
    if (type === 'error') {
      alert(`Error: ${message}`);
    }
  }

  /**
   * Add inline edit handlers to a channel row
   */
  addInlineEditHandlers(row, channel) {
    const editableCells = row.querySelectorAll('.editable-cell');
    const checkboxCells = row.querySelectorAll('.checkbox-cell');

    editableCells.forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startInlineEdit(cell, channel);
      });
    });

    checkboxCells.forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCheckbox(cell, channel);
      });
    });
  }

  /**
   * Start inline editing for a cell
   */
  startInlineEdit(cell, channel) {
    if (cell.classList.contains('editing')) return;

    const field = cell.dataset.field;
    const currentValue = this.getCurrentFieldValue(channel, field);
    
    cell.classList.add('editing');
    const originalContent = cell.innerHTML;

    let input;
    if (field === 'modulation') {
      input = this.createModulationSelect(currentValue);
    } else if (field === 'ctcssDcs') {
      input = this.createCTCSSDCSSelect(channel.ctcssDcs);
    } else if (field === 'delay') {
      input = this.createDelaySelect(channel.delay);
    } else if (field === 'frequency') {
      input = document.createElement('input');
      input.type = 'number';
      input.step = '0.000001';
      input.min = '25';
      input.max = '512';
      input.value = channel.frequency || '';
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.value = currentValue;
      if (field === 'name') {
        input.maxLength = 16;
      }
    }

    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();

    const saveEdit = () => {
      const newValue = input.value;
      this.saveInlineEdit(cell, channel, field, newValue);
    };

    const cancelEdit = () => {
      cell.classList.remove('editing');
      cell.innerHTML = originalContent;
    };

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    });
  }

  /**
   * Save inline edit
   */
  saveInlineEdit(cell, channel, field, newValue) {
    cell.classList.remove('editing');
    
    // Update channel data
    const channelIndex = this.channels.findIndex(ch => ch.index === channel.index);
    if (channelIndex === -1) return;

    const updatedChannel = { ...this.channels[channelIndex] };

    switch (field) {
      case 'name':
        updatedChannel.name = newValue.trim();
        break;
      case 'frequency':
        updatedChannel.frequency = parseFloat(newValue) || 0;
        break;
      case 'modulation':
        updatedChannel.modulation = newValue;
        break;
      case 'ctcssDcs':
        updatedChannel.ctcssDcs = parseInt(newValue);
        break;
      case 'delay':
        updatedChannel.delay = parseFloat(newValue);
        break;
    }

    // Update local data
    this.channels[channelIndex] = updatedChannel;

    // Update display
    this.updateCellDisplay(cell, updatedChannel, field);
    
    // Update row class for empty/non-empty
    const row = cell.parentElement;
    row.className = updatedChannel.name || updatedChannel.frequency > 0 ? '' : 'empty';
    
    this.showStatus(`Channel ${channel.index} updated`, 'success');
  }

  /**
   * Toggle checkbox field
   */
  toggleCheckbox(cell, channel) {
    const field = cell.dataset.field;
    const channelIndex = this.channels.findIndex(ch => ch.index === channel.index);
    if (channelIndex === -1) return;

    const updatedChannel = { ...this.channels[channelIndex] };
    updatedChannel[field] = !updatedChannel[field];

    // Update local data
    this.channels[channelIndex] = updatedChannel;

    // Update display
    const indicator = cell.querySelector('.checkbox-indicator');
    indicator.className = `checkbox-indicator ${updatedChannel[field] ? 'checked' : 'unchecked'}`;
    indicator.textContent = updatedChannel[field] ? '✓' : '✗';

    this.showStatus(`Channel ${channel.index} updated`, 'success');
  }

  /**
   * Get current field value for display
   */
  getCurrentFieldValue(channel, field) {
    switch (field) {
      case 'name':
        return channel.name || '';
      case 'frequency':
        return channel.frequency || '';
      case 'modulation':
        return channel.modulation;
      case 'delay':
        return channel.delay.toString();
      default:
        return '';
    }
  }

  /**
   * Update cell display after edit
   */
  updateCellDisplay(cell, channel, field) {
    switch (field) {
      case 'name':
        cell.textContent = channel.name || '';
        break;
      case 'frequency':
        cell.textContent = channel.frequency > 0 ? channel.frequency.toFixed(6) : '';
        break;
      case 'modulation':
        cell.textContent = channel.modulation;
        break;
      case 'ctcssDcs':
        cell.textContent = this.scanner.getCTCSSDCSText(channel.ctcssDcs);
        break;
      case 'delay':
        cell.textContent = channel.delay + 's';
        break;
    }
  }

  /**
   * Create modulation select
   */
  createModulationSelect(currentValue) {
    const select = document.createElement('select');
    const options = ['AUTO', 'AM', 'FM', 'NFM'];
    
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option;
      optionElement.textContent = option;
      if (option === currentValue) {
        optionElement.selected = true;
      }
      select.appendChild(optionElement);
    });
    
    return select;
  }

  /**
   * Create CTCSS/DCS select
   */
  createCTCSSDCSSelect(currentValue) {
    const select = document.createElement('select');
    
    // Add default options
    const defaultOptions = [
      { value: 0, text: 'NONE' },
      { value: 127, text: 'SEARCH' },
      { value: 240, text: 'NO_TONE' }
    ];
    
    defaultOptions.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      if (option.value === currentValue) {
        optionElement.selected = true;
      }
      select.appendChild(optionElement);
    });
    
    // Add CTCSS options
    Object.entries(this.scanner.ctcssCodes).forEach(([code, freq]) => {
      const optionElement = document.createElement('option');
      optionElement.value = code;
      optionElement.textContent = `CTCSS ${freq}Hz`;
      if (parseInt(code) === currentValue) {
        optionElement.selected = true;
      }
      select.appendChild(optionElement);
    });
    
    // Add DCS options
    Object.entries(this.scanner.dcsCodes).forEach(([code, dcs]) => {
      const optionElement = document.createElement('option');
      optionElement.value = code;
      optionElement.textContent = `DCS ${dcs}`;
      if (parseInt(code) === currentValue) {
        optionElement.selected = true;
      }
      select.appendChild(optionElement);
    });
    
    return select;
  }

  /**
   * Create delay select
   */
  createDelaySelect(currentValue) {
    const select = document.createElement('select');
    const options = [-10, -5, 0, 1, 2, 3, 4, 5];
    
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option;
      optionElement.textContent = option + 's';
      if (option === currentValue) {
        optionElement.selected = true;
      }
      select.appendChild(optionElement);
    });
    
    return select;
  }
}

// Initialize application when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new BC125ATApp();
});