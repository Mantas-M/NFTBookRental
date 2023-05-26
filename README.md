## NFT Book Rental

Made using the [ERC-4907](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-4907.md) standard

Running tests

- [ ] Clone the repository
- [ ] Run `npm install`
- [ ] Run `npx hardhat test`

**Note:** viewAvailableBooks, viewRentedBooks and getOwnedBooks functions can get very expensive as the book list grows. The implementation should be mitigated to use mappings and restrict the amount of books a person can borrow to avoid using arrays and iteration at all to reduce gas costs.
