# IoT Backend Systems Node-JS Client

A lightweight Node.js client that simulates IoT device communication with the IoT Backend Systems API over HTTP and WebSockets. Useful for testing, development, and demonstration of device-to-cloud workflows on Raspberry Pi or similar Linux-based hardware.

## Features

- **Session Initialization**  
  - Fetches a unique session ID from the IoT Backend Systems HTTP API  
  - Parses and stores `corps_id`, `corps_locations_id`, and `devices_id`  

- **Structured JSON Logging**  
  - Overrides `console.log()`, `console.warn()`, and `console.error()`  
  - Appends timestamped, pretty-printed JSON entries to `LogRecords.txt`  

- **Dynamic URL Builder**  
  - Automatically includes device serial, MAC & IP address, firmware info, locale settings, etc.  
  - Generates a fresh `pts` timestamp on every request  

- **WebSocket Heartbeat & Commands**  
  - Connects to the IoT Backend Systems Socket.io server and registers the session  
  - Sends “ping” every 5 s and handles server “pong” replies  
  - Supports remote commands: reboot, power-off, parameter reporting, log collection, and more  

- **File Upload**  
  - On demand, copies and uploads the current log file to the IoT Backend Systems upload endpoint  

## Prerequisites

- **Node.js** v14+  
- **npm** (or yarn)  
- A **Linux-based device** (e.g. Raspberry Pi) for correct network interface detection  
- Valid **IoT Backend Systems** credentials (serial number & session ID file)

## Installation

1. Clone the repo:  
   ```bash
   git clone https://github.com/YourUsername/iot-backend-systems-nodejs-client.git
   cd iot-backend-systems-nodejs-client
