// Function to add two numbers
function addNumbers(a, b) {
  return a + b;
}

// Example usage with predefined numbers
const num1 = 15;
const num2 = 25;
const result = addNumbers(num1, num2);

console.log(`Adding ${num1} + ${num2} = ${result}`);

// Example with different numbers
console.log(`Adding 10 + 5 = ${addNumbers(10, 5)}`);
console.log(`Adding 3.14 + 2.86 = ${addNumbers(3.14, 2.86)}`);

// You can also get numbers from command line arguments
if (process.argv.length > 3) {
  const arg1 = parseFloat(process.argv[2]);
  const arg2 = parseFloat(process.argv[3]);
  
  if (!isNaN(arg1) && !isNaN(arg2)) {
    console.log(`Command line: ${arg1} + ${arg2} = ${addNumbers(arg1, arg2)}`);
  } else {
    console.log('Please provide valid numbers as command line arguments');
  }
}

console.log('\nTo use with custom numbers, run: node add-numbers.js [number1] [number2]');