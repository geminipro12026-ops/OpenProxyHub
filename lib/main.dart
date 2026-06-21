import 'package:flutter/material.dart';

void main() {
  runApp(const OpenProxyHubApp());
}

class OpenProxyHubApp extends StatelessWidget {
  const OpenProxyHubApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'OpenProxyHub',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        brightness: Brightness.dark,
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  final List<Map<String, dynamic>> servers = const [
    {'name': 'Germany', 'status': 'Online', 'flag': '🇩🇪'},
    {'name': 'Finland', 'status': 'Online', 'flag': '🇫🇮'},
    {'name': 'Cloudflare', 'status': 'Syncing', 'flag': '☁️'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('OpenProxyHub'),
      ),
      body: ListView.builder(
        itemCount: servers.length,
        itemBuilder: (context, index) {
          final server = servers[index];

          return Card(
            margin: const EdgeInsets.all(10),
            child: ListTile(
              leading: Text(server['flag'], style: const TextStyle(fontSize: 24)),
              title: Text(server['name']),
              subtitle: Text(server['status']),
              trailing: const Icon(Icons.circle, color: Colors.green),
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {},
        child: const Icon(Icons.add),
      ),
    );
  }
}
