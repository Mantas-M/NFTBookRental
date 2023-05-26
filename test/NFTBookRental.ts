import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'

describe('NFTBookRental', function () {
  async function deployNFTBookRentalFixture() {
    const [deployer, otherAccount] = await ethers.getSigners()

    const NFTBookRental = await ethers.getContractFactory('NFTBookRental')
    const bookRentalService = await NFTBookRental.deploy(
      'NFTBookRental',
      'NFTBR'
    )

    await bookRentalService.deployed()

    return { bookRentalService, deployer, otherAccount }
  }

  async function deployAndCreateBookFixture() {
    const { bookRentalService, deployer, otherAccount } = await loadFixture(
      deployNFTBookRentalFixture
    )

    const tx = await bookRentalService.createBook(
      'https://www.examplecoverimage.com',
      'Mantas M',
      'The best book ever',
      2023,
      'English',
      'A book about making books'
    )

    await tx.wait()

    return { bookRentalService, deployer, otherAccount }
  }

  async function rentBookFixture() {
    const { bookRentalService, deployer, otherAccount } = await loadFixture(
      deployAndCreateBookFixture
    )

    const tx = await bookRentalService
      .connect(otherAccount)
      .rentBookRequest(1, { value: ethers.utils.parseEther('0.01') })

    await tx.wait()

    const currentTimestamp = (await ethers.provider.getBlock('latest'))
      .timestamp
    const rentalTime = BigNumber.from(currentTimestamp).add(2 * 24 * 60 * 60) // 2 days in seconds

    await bookRentalService.confirmRent(1, rentalTime)

    return { bookRentalService, deployer, otherAccount }
  }

  describe('NFT Rental Standard', function () {
    it('should return true if passed in ERC4907 interface id', async function () {
      const { bookRentalService } = await loadFixture(
        deployNFTBookRentalFixture
      )

      const interfaceId = await bookRentalService.getInterfaceId()

      expect(await bookRentalService.supportsInterface(interfaceId)).to.equal(
        true
      )
    })
  })

  describe('Creating a book', function () {
    it('should not allow user to create a book with missing information', async function () {
      const { bookRentalService } = await loadFixture(
        deployNFTBookRentalFixture
      )

      await expect(
        bookRentalService.createBook(
          'https://www.coverimage.com',
          'Mantas M',
          'The best book ever',
          2023,
          'English',
          ''
        )
      ).to.be.revertedWith('Description is required')
    })

    // Other tests for missing information

    it('should allow user to create a book', async function () {
      const { bookRentalService } = await loadFixture(
        deployNFTBookRentalFixture
      )

      await expect(
        bookRentalService.createBook(
          'https://www.coverimage.com',
          'Mantas M',
          'The best book ever',
          2023,
          'English',
          'A book about making books'
        )
      ).to.emit(bookRentalService, 'BookCreated')

      const bookIds = await bookRentalService.getOwnedBooks()
      const availableBooks = await bookRentalService.viewAvailableBooks()

      expect(bookIds.length).to.equal(1)
      expect(bookIds[0]).to.equal(BigNumber.from(1))
      expect(availableBooks.length).to.equal(1)
      expect(availableBooks[0]).to.equal(BigNumber.from(1))
    })
  })

  describe('Deleting a Book', function () {
    it('should not allow user to delete a book that does not exist', async function () {
      const { bookRentalService } = await loadFixture(
        deployNFTBookRentalFixture
      )

      await expect(bookRentalService.deleteBook(1)).to.be.revertedWith(
        'Book does not exist'
      )
    })

    it('should not allow user to delete a book that is not theirs', async function () {
      const { bookRentalService, otherAccount } = await loadFixture(
        deployAndCreateBookFixture
      )

      await expect(
        bookRentalService.connect(otherAccount).deleteBook(1)
      ).to.be.revertedWith('Only the owner can perform this operation')
    })

    it('should not allow user to delete a book that is rented', async function () {
      const { bookRentalService } = await loadFixture(rentBookFixture)

      await expect(bookRentalService.deleteBook(1)).to.be.revertedWith(
        'Cannot perform operation on a rented book'
      )
    })

    it('should allow user to delete a book', async function () {
      const { bookRentalService } = await loadFixture(
        deployAndCreateBookFixture
      )

      await expect(bookRentalService.deleteBook(1)).to.emit(
        bookRentalService,
        'BookDeleted'
      )

      const bookIds = await bookRentalService.getOwnedBooks()

      expect(bookIds.length).to.equal(0)
    })
  })

  describe('Book rental request', function () {
    it('should not allow user to request a book that does not exist', async function () {
      const { bookRentalService, otherAccount } = await loadFixture(
        deployNFTBookRentalFixture
      )

      await expect(
        bookRentalService
          .connect(otherAccount)
          .rentBookRequest(1, { value: ethers.utils.parseEther('0.01') })
      ).to.be.revertedWith('Book does not exist')
    })

    it('should not allow user to request a book that is theirs', async function () {
      const { bookRentalService } = await loadFixture(
        deployAndCreateBookFixture
      )

      await expect(
        bookRentalService.rentBookRequest(1, {
          value: ethers.utils.parseEther('0.01'),
        })
      ).to.be.revertedWith('Cannot request a book that you own')
    })

    it('should not allow user to request a book that is already rented', async function () {
      const { bookRentalService, otherAccount } = await rentBookFixture()

      await expect(
        bookRentalService.connect(otherAccount).rentBookRequest(1, {
          value: ethers.utils.parseEther('0.01'),
        })
      ).to.be.revertedWith('Cannot perform operation on a rented book')
    })

    it('should not allow user to request a book with insufficient funds', async function () {
      const { bookRentalService, otherAccount } = await loadFixture(
        deployAndCreateBookFixture
      )

      await expect(
        bookRentalService
          .connect(otherAccount)
          .rentBookRequest(1, { value: ethers.utils.parseEther('0.001') })
      ).to.be.revertedWith('You must send exactly 0.01 ETH to request a book')
    })

    it('should allow user to request a book', async function () {
      const { bookRentalService, otherAccount } = await loadFixture(
        deployAndCreateBookFixture
      )

      await expect(
        bookRentalService
          .connect(otherAccount)
          .rentBookRequest(1, { value: ethers.utils.parseEther('0.01') })
      ).to.emit(bookRentalService, 'BookRequested')
    })
  })

  describe('Book rental confirmation', function () {
    it('should not allow user to confirm a rental that does not exist', async function () {
      const { bookRentalService, otherAccount } = await rentBookFixture()

      await expect(
        bookRentalService
          .connect(otherAccount)
          .confirmRent(2, BigNumber.from(0))
      ).to.be.revertedWith('Book does not exist')
    })

    it('should not allow user to confirm a rental that is not theirs', async function () {
      const { bookRentalService, otherAccount } = await rentBookFixture()

      await expect(
        bookRentalService
          .connect(otherAccount)
          .confirmRent(1, BigNumber.from(0))
      ).to.be.revertedWith('Only the owner can perform this operation')
    })

    it('should not allow user to confirm a rental that is already confirmed', async function () {
      const { bookRentalService } = await rentBookFixture()

      await expect(
        bookRentalService.confirmRent(1, BigNumber.from(0))
      ).to.be.revertedWith('Cannot perform operation on a rented book')
    })

    it('should not allow user to confirm a rental when it is not pending', async function () {
      const { bookRentalService } = await deployAndCreateBookFixture()

      await expect(
        bookRentalService.confirmRent(1, BigNumber.from(0))
      ).to.be.revertedWith('This book does not have a pending request')
    })

    it('should allow user to confirm a rental', async function () {
      const { bookRentalService, otherAccount } =
        await deployAndCreateBookFixture()

      const currentTimestamp = (await ethers.provider.getBlock('latest'))
        .timestamp
      const rentalTime = BigNumber.from(currentTimestamp).add(2 * 24 * 60 * 60) // 2 days in seconds

      const tx = await bookRentalService
        .connect(otherAccount)
        .rentBookRequest(1, { value: ethers.utils.parseEther('0.01') })

      await tx.wait()

      await expect(bookRentalService.confirmRent(1, rentalTime)).to.emit(
        bookRentalService,
        'BookRented'
      )

      const availableBooks = await bookRentalService.viewAvailableBooks()
      const rentedBooks = await bookRentalService
        .connect(otherAccount)
        .viewRentedBooks()

      expect(availableBooks.length).to.equal(0)
      expect(rentedBooks.length).to.equal(1)
      expect(rentedBooks[0]).to.equal(1)
    })
  })

  // Book rental rejection and return tests

  describe('Happy Path Scenario', function () {
    it('should allow user to make a book, request a book, confirm the rental and confirm the return of a book', async function () {
      const { bookRentalService, otherAccount } =
        await deployAndCreateBookFixture()

      let availableBooks = await bookRentalService.viewAvailableBooks()
      let rentedBooks = await bookRentalService
        .connect(otherAccount)
        .viewRentedBooks()

      expect(availableBooks.length).to.equal(1)
      expect(rentedBooks.length).to.equal(0)

      const currentTimestamp = (await ethers.provider.getBlock('latest'))
        .timestamp
      const rentalTime = BigNumber.from(currentTimestamp).add(2 * 24 * 60 * 60) // 2 days in seconds

      await bookRentalService
        .connect(otherAccount)
        .rentBookRequest(1, { value: ethers.utils.parseEther('0.01') })

      await bookRentalService.confirmRent(1, rentalTime)

      availableBooks = await bookRentalService.viewAvailableBooks()
      rentedBooks = await bookRentalService
        .connect(otherAccount)
        .viewRentedBooks()

      expect(availableBooks.length).to.equal(0)
      expect(rentedBooks.length).to.equal(1)

      await bookRentalService.confirmReturn(1)

      availableBooks = await bookRentalService.viewAvailableBooks()

      rentedBooks = await bookRentalService
        .connect(otherAccount)
        .viewRentedBooks()

      expect(availableBooks.length).to.equal(1)
      expect(rentedBooks.length).to.equal(0)
    })
  })
})
