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
      theme: ThemeData.dark(),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  List<Map<String, String>> servers = [
    {'name': 'Germany', 'status': 'Online', 'flag': '🇩🇪'},
    {'name': 'Finland', 'status': 'Online', 'flag': '🇫🇮'},
    {'name': 'Cloudflare', 'status': 'Syncing', 'flag': '☁️'},
  ];

  void _addServer(String name) {
    setState(() {
      servers.add({
        'name': name,
        'status': 'Online',
        'flag': '🆕',
      });
    });
  }

  void _showAddServerDialog() {
    String newServerName = '';

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Add Server'),
          content: TextField(
            onChanged: (value) {
              newServerName = value;
            },
            decoration: const InputDecoration(
              hintText: 'Enter server name',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                if (newServerName.isNotEmpty) {
                  _addServer(newServerName);
                }
                Navigator.pop(context);
              },
              child: const Text('Add'),
            ),
          ],
        );
      },
    );
  }

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
              leading: Text(server['flag']!, style: const TextStyle(fontSize: 24)),
              title: Text(server['name']!),
              subtitle: Text(server['status']!),
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddServerDialog,
        child: const Icon(Icons.add),
      ),
    );
  }
}
