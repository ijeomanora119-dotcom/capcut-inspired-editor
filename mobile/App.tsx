import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, SafeAreaView, Pressable } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>ClipFlow Mobile</Text>
        <Text style={styles.subtitle}>CapCut-inspired editor starter for mobile</Text>

        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Create project</Text>
        </Pressable>

        <Pressable style={[styles.button, styles.secondaryButton]}>
          <Text style={styles.buttonText}>Import media</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Included</Text>
          <Text style={styles.cardText}>• Timeline overview</Text>
          <Text style={styles.cardText}>• Trim & split</Text>
          <Text style={styles.cardText}>• Captions</Text>
          <Text style={styles.cardText}>• Filters</Text>
        </View>
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1020',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#0b1020',
  },
  title: {
    color: '#f3f6fb',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#a9bdd8',
    fontSize: 16,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: '#2563eb',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  card: {
    marginTop: 20,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    color: '#f3f6fb',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardText: {
    color: '#dbeafe',
    fontSize: 14,
    marginBottom: 4,
  },
});
