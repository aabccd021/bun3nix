import isEven from "is-even";
import _ from "lodash";

// Using _.map to create a new array by applying a function to each element
const squaredNumbers = _.map([1, 2, 3], (num) => num * num);

// Using _.filter to create a new array containing only the elements that satisfy a condition
const evenNumbers = _.filter([1, 2, 3, 4, 5], (num) => isEven(num));

console.log(`Squared Numbers: [${squaredNumbers}], Even Numbers: [${evenNumbers}]`);
