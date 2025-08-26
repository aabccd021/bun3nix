import isEven from "is-even";
import _ from "lodash";

if (_.filter([1, 2, 3], isEven).at(0) !== 2) throw new Error();
