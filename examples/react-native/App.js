import React, { Component } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import io from 'socket.io-client';

const socket = io("192.168.0.28:3000"); // replace with the IP of your server, when testing on real devices

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      connected: socket.connected,
      currentTransport: socket.connected ? socket.io.engine.transport.name : '-',
      lastMessage: ""
    };
  }

  componentDidMount() {
    socket.on('connect', () => this.onConnectionStateUpdate());
    socket.on('disconnect', () => this.onConnectionStateUpdate());
    socket.on('message', (content) => this.onMessage(content));
  }

  componentWillUnmount() {
    socket.off('connect');
    socket.off('disconnect');
    socket.off('message');
  }

  onConnectionStateUpdate() {
    this.setState({
      connected: socket.connected,
      currentTransport: socket.connected ? socket.io.engine.transport.name : '-'
    });
    if (socket.connected) {
      socket.io.engine.on('upgrade', () => this.onUpgrade());
    } else {
      socket.io.engine.off('upgrade');
    }
  }

  onMessage(content) {
    this.setState({
      lastMessage: content
    });
  }

  onUpgrade() {
    this.setState({
      currentTransport: socket.io.engine.transport.name
    });
  }

  render() {
    return (
      <View style={styles.container}>
        <Text>State: { this.state.connected ? 'Connected' : 'Disconnected' }</Text>
        <Text>Current transport: { this.state.currentTransport }</Text>
        <Text>Last message: { this.state.lastMessage }</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
