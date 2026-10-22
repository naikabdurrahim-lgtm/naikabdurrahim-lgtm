import { CustomerListScreen } from '../components/CustomerListScreen';

/**
 * বাকি — the one button a shopkeeper taps at closing time.
 *
 * Simple Mode lands here with the total on top and every debtor below it, each
 * with a collect button, so "কে কত বাকি" is answered without a single extra tap.
 */
export function DuePage() {
  return <CustomerListScreen mode="due" />;
}
