from web3 import Web3
import json
from time import sleep
import requests

class BSCBalanceChecker:
    def __init__(self):
        # Multiple BSC RPC endpoints for reliability
        self.rpc_endpoints = [
            'https://bsc-dataseed.binance.org/',
            'https://bsc-dataseed1.defibit.io/',
            'https://bsc-dataseed1.ninicoin.io/',
            'https://bsc-dataseed2.defibit.io/',
            'https://bsc-dataseed3.defibit.io/',
            'https://bsc-dataseed4.defibit.io/',
            'https://bsc-dataseed2.ninicoin.io/',
            'https://bsc-dataseed3.ninicoin.io/',
            'https://bsc-dataseed4.ninicoin.io/'
        ]
        self.w3 = None
        self.current_endpoint = None
        self.connect_to_node()
        
        # USDT contract configuration
        self.usdt_contract_address = Web3.to_checksum_address('0x55d398326f99059fF775485246999027B3197955')
        self.usdt_abi = [
            {
                "constant": True,
                "inputs": [{"name": "_owner", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "balance", "type": "uint256"}],
                "type": "function"
            },
            {
                "constant": True,
                "inputs": [],
                "name": "decimals",
                "outputs": [{"name": "", "type": "uint8"}],
                "type": "function"
            }
        ]
        self.usdt_contract = self.w3.eth.contract(
            address=self.usdt_contract_address,
            abi=self.usdt_abi
        )
        
    def connect_to_node(self):
        """Connect to BSC node with multiple fallback endpoints"""
        for endpoint in self.rpc_endpoints:
            try:
                print(f"Trying to connect to: {endpoint}")
                self.w3 = Web3(Web3.HTTPProvider(endpoint, request_kwargs={'timeout': 30}))
                
                # Test connection
                if self.w3.is_connected():
                    block_number = self.w3.eth.block_number
                    self.current_endpoint = endpoint
                    print(f"✓ Connected to BSC node: {endpoint}")
                    print(f"Current block: {block_number}")
                    return True
                else:
                    print(f"✗ Failed to connect to: {endpoint}")
                    
            except Exception as e:
                print(f"✗ Connection failed to {endpoint}: {str(e)}")
                continue
        
        raise Exception("❌ Could not connect to any BSC node. Please check your internet connection.")
    
    def switch_node(self):
        """Switch to a different node if current one fails"""
        current_index = self.rpc_endpoints.index(self.current_endpoint) if self.current_endpoint else -1
        next_endpoints = self.rpc_endpoints[current_index + 1:] + self.rpc_endpoints[:current_index]
        
        for endpoint in next_endpoints:
            try:
                print(f"Switching to backup node: {endpoint}")
                self.w3 = Web3(Web3.HTTPProvider(endpoint, request_kwargs={'timeout': 30}))
                if self.w3.is_connected():
                    self.current_endpoint = endpoint
                    print(f"✓ Switched to: {endpoint}")
                    return True
            except Exception as e:
                print(f"✗ Failed to switch to {endpoint}: {str(e)}")
                continue
        
        return False
    
    def get_bnb_balance(self, address):
        """Get BNB balance for an address"""
        try:
            checksum_address = Web3.to_checksum_address(address)
            balance_wei = self.w3.eth.get_balance(checksum_address)
            balance_bnb = self.w3.from_wei(balance_wei, 'ether')
            return float(balance_bnb)
        except Exception as e:
            print(f"Error getting BNB balance for {address}: {str(e)}")
            # Try switching node
            if self.switch_node():
                return self.get_bnb_balance(address)
            return 0
    
    def get_usdt_balance(self, address):
        """Get USDT balance for an address"""
        try:
            checksum_address = Web3.to_checksum_address(address)
            balance_units = self.usdt_contract.functions.balanceOf(checksum_address).call()
            decimals = self.usdt_contract.functions.decimals().call()
            balance_usdt = balance_units / (10 ** decimals)
            return float(balance_usdt)
        except Exception as e:
            print(f"Error getting USDT balance for {address}: {str(e)}")
            # Try switching node
            if self.switch_node():
                return self.get_usdt_balance(address)
            return 0
    
    def check_single_address(self, address):
        """Check both BNB and USDT balances for a single address"""
        try:
            bnb_balance = self.get_bnb_balance(address)
            usdt_balance = self.get_usdt_balance(address)
            return bnb_balance, usdt_balance
        except Exception as e:
            print(f"Failed to check balances for {address}: {str(e)}")
            return 0, 0
    
    def check_all_addresses(self, json_file_path, batch_size=50):
        """Check balances for all addresses in the JSON file"""
        print(f"Loading addresses from: {json_file_path}")
        
        try:
            with open(json_file_path, 'r', encoding='utf-8') as file:
                addresses_data = json.load(file)
        except Exception as e:
            print(f"Error loading JSON file: {str(e)}")
            return []
        
        print(f"Found {len(addresses_data)} addresses to check")
        
        results = []
        successful_checks = 0
        failed_checks = 0
        
        for i, item in enumerate(addresses_data):
            address = item['bsc_wallet_address']
            
            # Validate address format
            if not Web3.is_address(address):
                print(f"Invalid address format: {address}")
                failed_checks += 1
                results.append({
                    'bsc_wallet_address': address,
                    'bnb_balance': 0,
                    'usdt_balance': 0,
                    'status': 'invalid_address'
                })
                continue
            
            print(f"Checking {i+1}/{len(addresses_data)}: {address}")
            
            try:
                bnb_balance, usdt_balance = self.check_single_address(address)
                
                result = {
                    'bsc_wallet_address': address,
                    'bnb_balance': bnb_balance,
                    'usdt_balance': usdt_balance,
                    'status': 'success'
                }
                results.append(result)
                successful_checks += 1
                
                if bnb_balance > 0 or usdt_balance > 0:
                    print(f"  ✓ BNB: {bnb_balance:.6f} | USDT: {usdt_balance:.4f} 💰")
                else:
                    print(f"  ✓ BNB: {bnb_balance:.6f} | USDT: {usdt_balance:.4f}")
                    
            except Exception as e:
                print(f"  ✗ Failed: {str(e)}")
                failed_checks += 1
                results.append({
                    'bsc_wallet_address': address,
                    'bnb_balance': 0,
                    'usdt_balance': 0,
                    'status': 'failed'
                })
            
            # Add delay and progress reporting
            if (i + 1) % batch_size == 0:
                print(f"\n📍 Progress: {i+1}/{len(addresses_data)} addresses checked")
                print(f"✅ Successful: {successful_checks}, ❌ Failed: {failed_checks}")
                sleep(2)  # Longer delay after each batch
            
            elif (i + 1) % 10 == 0:
                sleep(0.5)  # Small delay every 10 addresses
        
        print(f"\n🎯 Final Results: {successful_checks} successful, {failed_checks} failed")
        return results
    
    def save_results(self, results, output_file='addresses_with_balances.json'):
        """Save results to JSON file"""
        try:
            with open(output_file, 'w', encoding='utf-8') as file:
                json.dump(results, file, indent=2)
            print(f"💾 Results saved to: {output_file}")
        except Exception as e:
            print(f"Error saving results: {str(e)}")
    
    def generate_summary(self, results):
        """Generate and display summary of results"""
        total_addresses = len(results)
        successful_checks = len([r for r in results if r.get('status') == 'success'])
        addresses_with_balance = [r for r in results if (r.get('bnb_balance', 0) > 0 or r.get('usdt_balance', 0) > 0) and r.get('status') == 'success']
        
        total_bnb = sum(r.get('bnb_balance', 0) for r in results)
        total_usdt = sum(r.get('usdt_balance', 0) for r in results)
        
        print(f"\n{'='*60}")
        print(f"📊 CHECK SUMMARY")
        print(f"{'='*60}")
        print(f"Total addresses: {total_addresses}")
        print(f"Successful checks: {successful_checks}")
        print(f"Addresses with balance: {len(addresses_with_balance)}")
        print(f"Total BNB: {total_bnb:.6f}")
        print(f"Total USDT: {total_usdt:.4f}")
        print(f"{'='*60}")
        
        if addresses_with_balance:
            print(f"\n💰 ADDRESSES WITH BALANCE:")
            print(f"{'='*60}")
            for result in addresses_with_balance[:20]:  # Show first 20
                address = result['bsc_wallet_address']
                bnb = result['bnb_balance']
                usdt = result['usdt_balance']
                print(f"{address}")
                print(f"  BNB: {bnb:.6f} | USDT: {usdt:.4f}")
            
            if len(addresses_with_balance) > 20:
                print(f"... and {len(addresses_with_balance) - 20} more addresses with balance")

def main():
    print("🚀 BSC Balance Checker - Starting...")
    print("This script will check BNB and USDT balances for all addresses")
    print("Using Web3.py with multiple BSC RPC endpoints for reliability\n")
    
    try:
        # Initialize the balance checker
        checker = BSCBalanceChecker()
        
        # File paths
        input_file = 'addresses.json'
        output_file = 'addresses_with_balances.json'
        
        # Check balances
        results = checker.check_all_addresses(input_file)
        
        # Generate summary
        checker.generate_summary(results)
        
        # Save results
        checker.save_results(results, output_file)
        
        print(f"\n✅ Check completed successfully!")
        print(f"📁 Results saved to: {output_file}")
        
    except Exception as e:
        print(f"❌ Fatal error: {str(e)}")
        print("Please check your internet connection and try again.")

if __name__ == "__main__":
    main()