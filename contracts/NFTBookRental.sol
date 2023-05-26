// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./IERC4907.sol";

contract NFTBookRental is ERC721, IERC4907 {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;
    uint256 private _rentalFee = 0.01 ether;

    modifier onlyOwnerOf(uint256 bookId) {
        require(_books[bookId].owner == msg.sender, "Only the owner can perform this operation");
        _;
    }

    modifier bookExists(uint256 bookId) {
        require(_exists(bookId), "Book does not exist");
        _;
    }

    modifier bookNotRented(uint256 bookId) {
        require(userOf(bookId) == address(0), "Cannot perform operation on a rented book");
        _;
    }

    modifier bookRequested(uint256 bookId) {
        require(_books[bookId].requestedBy != address(0), "This book does not have a pending request");
        _;
    }

    modifier notBookOwner(uint256 bookId) {
        require(_books[bookId].owner != msg.sender, "Cannot request a book that you own");
        _;
    }

    modifier exactRentFee {
        require(msg.value == _rentalFee, "You must send exactly 0.01 ETH to request a book");
        _;
    }

    modifier validExpiry(uint64 expiry) {
        require(expiry > block.timestamp + 1 days, "The expiry must be at least 1 day in the future");
        _;
    }

    struct Book {
        string coverImage;
        string author;
        string title;
        uint256 year;
        string language;
        string description;
        address owner;
        address requestedBy;
    }

    struct UserInfo {
        address user;   // address of user role
        uint64 expires; // unix timestamp, user expires
    }

    mapping (uint256  => UserInfo) internal _users;
    mapping(uint256 => Book) private _books;

    event BookCreated(uint256 tokenId, address owner);
    event BookDeleted(uint256 tokenId, address owner);
    event BookRented(uint256 tokenId, address renter, uint256 expires);
    event BookReturned(uint256 tokenId, address renter);
    event BookRequested(uint256 tokenId, address renter);

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

     function createBook(
        string memory coverImage,
        string memory author,
        string memory title,
        uint256 year,
        string memory language,
        string memory description
    ) public {
        require(bytes(coverImage).length > 0, "Cover image is required");
        require(bytes(author).length > 0, "Author is required");
        require(bytes(title).length > 0, "Title is required");
        require(year > 0, "Year is required");
        require(bytes(language).length > 0, "Language is required");
        require(bytes(description).length > 0, "Description is required");

        _tokenIdCounter.increment();
        uint256 newBookId = _tokenIdCounter.current();
        _mint(msg.sender, newBookId);

        Book memory newBook = Book({
            coverImage: coverImage,
            author: author,
            title: title,
            year: year,
            language: language,
            description: description,
            owner: msg.sender,
            requestedBy: address(0)
        });

        _books[newBookId] = newBook;
        emit BookCreated(newBookId, msg.sender);
    }

    function deleteBook(uint256 bookId) bookExists(bookId) onlyOwnerOf(bookId) bookNotRented(bookId) public {
        _burn(bookId);
        delete _books[bookId];
        emit BookDeleted(bookId, msg.sender);
    }

    function rentBookRequest(uint256 bookId) public payable bookExists(bookId) bookNotRented(bookId) notBookOwner(bookId) exactRentFee(){
        _books[bookId].requestedBy = msg.sender; // store the request

        emit BookRequested(bookId, msg.sender);
    }

    function confirmRent(uint256 bookId, uint64 expiry) public bookExists(bookId) onlyOwnerOf(bookId) bookNotRented(bookId) bookRequested(bookId) validExpiry(expiry)   {
        setUser(bookId, _books[bookId].requestedBy, expiry); // set the user and expiry 

        _books[bookId].requestedBy = address(0); // reset the request
        emit BookRented(bookId, userOf(bookId), userExpires(bookId));
    }

    function rejectRentRequest(uint256 bookId) public bookExists(bookId) onlyOwnerOf(bookId) bookNotRented(bookId) bookRequested(bookId) {
        UserInfo storage requestingUser = _users[bookId];

        // Refund the deposit
        payable(requestingUser.user).transfer(_rentalFee);

        // Remove the user and reset the expiry
        setUser(bookId, address(0), 0);
        _books[bookId].requestedBy = address(0); // reset the request
    }

    function confirmReturn(uint256 bookId) public bookExists(bookId) onlyOwnerOf(bookId)  {
        UserInfo storage rentingUser = _users[bookId];
        require(rentingUser.user != address(0), "This book is not rented");

        // Refund the deposit
        payable(rentingUser.user).transfer(_rentalFee);

        // Remove the user and reset the expires
        setUser(bookId, address(0), 0);

        emit BookReturned(bookId, rentingUser.user);
    }


      // This function allows a renter to view the list of available books
    function viewAvailableBooks() public view returns (uint256[] memory) {
        uint256 totalBooks = _tokenIdCounter.current();
        uint256[] memory availableBooks = new uint256[](totalBooks);
        uint256 availableBookCount = 0;

        for (uint256 i = 1; i <= totalBooks; i++) {
            if (userOf(i) == address(0)) {
                availableBooks[availableBookCount] = i;
                availableBookCount++;
            }
        }

        // Copy the availableBooks array into a smaller array
        uint256[] memory result = new uint256[](availableBookCount);
        for (uint256 i = 0; i < availableBookCount; i++) {
            result[i] = availableBooks[i];
        }

        return result;
    }

    // This function allows a renter to view the list of books they have rented
    function viewRentedBooks() public view returns (uint256[] memory) {
        uint256 totalBooks = _tokenIdCounter.current();
        uint256[] memory rentedBooks = new uint256[](totalBooks);
        uint256 rentedBookCount = 0;

        for (uint256 i = 1; i <= totalBooks; i++) {
            if (_users[i].user == msg.sender) {
                rentedBooks[rentedBookCount] = i;
                rentedBookCount++;
            }
        }

        // Copy the rentedBooks array into a smaller array
        uint256[] memory result = new uint256[](rentedBookCount);
        for (uint256 i = 0; i < rentedBookCount; i++) {
            result[i] = rentedBooks[i];
        }

        return result;
    }

    function getOwnedBooks() public view returns (uint256[] memory) {
        uint256 totalBooks = _tokenIdCounter.current();
        uint256[] memory ownedBooks = new uint256[](totalBooks);
        uint256 count = 0;

        for (uint256 i = 1; i <= totalBooks; i++) { 
            if (_books[i].owner == msg.sender) {
                ownedBooks[count] = i;
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = ownedBooks[i];
        }

        return result;
    }

    // ERC4907 functions below
    
    /// @notice set the user and expires of an NFT
    /// @dev The zero address indicates there is no user
    /// Throws if `tokenId` is not valid NFT
    /// @param user  The new user of the NFT
    /// @param expires  UNIX timestamp, The new user could use the NFT before expires
    function setUser(uint256 tokenId, address user, uint64 expires) public virtual{
        require(_isApprovedOrOwner(msg.sender, tokenId), "ERC4907: transfer caller is not owner nor approved");
        UserInfo storage info =  _users[tokenId];
        info.user = user;
        info.expires = expires;
        emit UpdateUser(tokenId, user, expires);
    }

    /// @notice Get the user address of an NFT
    /// @dev The zero address indicates that there is no user or the user is expired
    /// @param tokenId The NFT to get the user address for
    /// @return The user address for this NFT
    function userOf(uint256 tokenId) public view virtual returns(address){
        if( uint256(_users[tokenId].expires) >=  block.timestamp){
            return  _users[tokenId].user;
        }
        else{
            return address(0);
        }
    }

    /// @notice Get the user expires of an NFT
    /// @dev The zero value indicates that there is no user
    /// @param tokenId The NFT to get the user expires for
    /// @return The user expires for this NFT
    function userExpires(uint256 tokenId) public view virtual returns(uint256){
        return _users[tokenId].expires;
    }

    // Removes a user from an NFT before transfering it
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override{
        super._beforeTokenTransfer(from, to, tokenId, batchSize);

        if (from != to && _users[tokenId].user != address(0)) {
            delete _users[tokenId];
            emit UpdateUser(tokenId, address(0), 0);
        }
    }

    /// @dev See {IERC165-supportsInterface}.
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC4907).interfaceId || super.supportsInterface(interfaceId);
    }

    /// For testing
    function getInterfaceId() public pure returns (bytes4) {
        return type(IERC4907).interfaceId;
    }
} 
